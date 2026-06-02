// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import "../libraries/PaymentLib.sol";

enum ConsensusType { Majority, Threshold }

enum ResponseStatus {
    None,
    Pending,
    Success,
    Failed,
    TimedOut
}

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}

interface IPaymentIntentRegistry {
    function getIntent(bytes32 intentId)
        external
        view
        returns (PaymentLib.PaymentIntent memory, PaymentLib.Recipient[] memory);

    function updateStatus(bytes32 intentId, PaymentLib.Status status) external;
}

interface ILLMAgent {
    function inferString(
        string calldata systemPrompt,
        string calldata userPrompt,
        string[] calldata allowedValues
    ) external returns (string memory);
}

contract PlannerGateway is SomniaEventHandler, Ownable {
    IAgentRequester public immutable platform;
    IPaymentIntentRegistry public immutable registry;

    uint256 public constant LLM_INFERENCE_AGENT_ID = 12875401142070969085;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant LLM_COST_PER_AGENT = 0.03 ether;

    mapping(uint256 => bytes32) private _requestToIntent;
    mapping(bytes32 => bool) private _pendingIntents;

    uint256 private _subscriptionId;

    event SettlementPlanSubmitted(bytes32 indexed intentId, bytes32 planHash, address planner);
    event PlanningFailed(bytes32 indexed intentId, uint256 requestId, ResponseStatus status);

    error OnlyPlatform();
    error UnknownRequest(uint256 requestId);

    address private _registryAddress;

    constructor(
        address platform_,
        address paymentIntentRegistry_
    ) Ownable(msg.sender) {
        platform = IAgentRequester(platform_);
        registry = IPaymentIntentRegistry(paymentIntentRegistry_);
        _registryAddress = paymentIntentRegistry_;
    }

    function initSubscription() external onlyOwner {
        bytes32[4] memory topics;
        topics[0] = keccak256("PaymentIntentCreated(bytes32,address,uint256)");

        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: topics,
            origin: address(0),
            emitter: _registryAddress
        });

        SomniaExtensions.SubscriptionOptions memory options = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 1_000_000_000,
            maxFeePerGas: 10_000_000_000,
            gasLimit: 2_000_000
        });

        _subscriptionId = SomniaExtensions.subscribe(address(this), filter, options);
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (emitter != address(registry)) return;
        if (eventTopics.length == 0) return;
        if (eventTopics[0] != keccak256("PaymentIntentCreated(bytes32,address,uint256)")) return;

        bytes32 intentId = eventTopics[1];

        if (_pendingIntents[intentId]) return;

        (PaymentLib.PaymentIntent memory intent, PaymentLib.Recipient[] memory recipients) =
            registry.getIntent(intentId);

        string memory intentJson = _buildIntentJson(intent, recipients);

        string[] memory allowedValues = new string[](2);
        allowedValues[0] = "valid";
        allowedValues[1] = "invalid";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            "You are a payment settlement validator. Inspect the payment intent JSON. "
            "Check: (1) all recipient bps values sum to exactly 10000, "
            "(2) each bps value is > 0, (3) amount > 0, (4) at least one recipient. "
            "Respond only with 'valid' or 'invalid'.",
            intentJson,
            allowedValues
        );

        uint256 reserve = platform.getRequestDeposit();
        uint256 deposit = reserve + (LLM_COST_PER_AGENT * SUBCOMMITTEE_SIZE);

        if (address(this).balance < deposit) return;

        uint256 requestId = platform.createRequest{value: deposit}(
            LLM_INFERENCE_AGENT_ID,
            address(this),
            this.handlePlannerResponse.selector,
            payload
        );

        _requestToIntent[requestId] = intentId;
        _pendingIntents[intentId] = true;
    }

    function handlePlannerResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        if (msg.sender != address(platform)) revert OnlyPlatform();
        bytes32 intentId = _requestToIntent[requestId];
        if (intentId == bytes32(0)) revert UnknownRequest(requestId);

        delete _requestToIntent[requestId];
        delete _pendingIntents[intentId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            registry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit PlanningFailed(intentId, requestId, status);
            return;
        }

        string memory verdict = abi.decode(responses[0].result, (string));

        if (keccak256(bytes(verdict)) != keccak256(bytes("valid"))) {
            registry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit PlanningFailed(intentId, requestId, status);
            return;
        }

        bytes32 planHash = keccak256(abi.encode(intentId, responses[0].result, block.timestamp));
        registry.updateStatus(intentId, PaymentLib.Status.PLANNED);

        emit SettlementPlanSubmitted(intentId, planHash, address(this));
    }

    function _buildIntentJson(
        PaymentLib.PaymentIntent memory intent,
        PaymentLib.Recipient[] memory recipients
    ) internal pure returns (string memory) {
        string memory recipientsJson = "[";
        for (uint256 i = 0; i < recipients.length; i++) {
            if (i > 0) recipientsJson = string(abi.encodePacked(recipientsJson, ","));
            recipientsJson = string(abi.encodePacked(
                recipientsJson,
                '{"role":"', recipients[i].role,
                '","bps":', _uint2str(recipients[i].bps), "}"
            ));
        }
        recipientsJson = string(abi.encodePacked(recipientsJson, "]"));

        return string(abi.encodePacked(
            '{"intentId":"', _bytes32ToHex(intent.intentId),
            '","amount":', _uint2str(intent.amount),
            ',"recipients":', recipientsJson, "}"
        ));
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 len;
        while (tmp != 0) { len++; tmp /= 10; }
        bytes memory buf = new bytes(len);
        while (v != 0) { len--; buf[len] = bytes1(uint8(48 + (v % 10))); v /= 10; }
        return string(buf);
    }

    function _bytes32ToHex(bytes32 b) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0"; str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = hexChars[uint8(b[i] >> 4)];
            str[3 + i * 2] = hexChars[uint8(b[i] & 0x0f)];
        }
        return string(str);
    }

    function cancelSubscription() external onlyOwner {
        SomniaExtensions.unsubscribe(_subscriptionId);
    }

    function withdrawFunds(address to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }

    receive() external payable {}
}
