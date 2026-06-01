// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import "../libraries/PaymentLib.sol";
import "./PaymentIntentRegistry.sol";
import "./PaymentReceiptRegistry.sol";

interface IAgentPlatform {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}

interface ILLMAgent {
    function inferString(
        string calldata systemPrompt,
        string calldata userPrompt,
        string[] calldata allowedValues
    ) external returns (string memory);
}

contract VerifierGateway is SomniaEventHandler, Ownable {
    struct PendingVerification {
        bytes32 intentId;
        bool exists;
    }

    struct Response {
        bytes result;
        uint8 status;
    }

    enum ResponseStatus {
        None,
        Pending,
        Success,
        Failed,
        TimedOut
    }

    struct Request {
        uint256 agentId;
        address callbackAddress;
        bytes4 callbackSelector;
        bytes payload;
    }

    IAgentPlatform public immutable agentPlatform;
    PaymentIntentRegistry public immutable intentRegistry;
    PaymentReceiptRegistry public immutable receiptRegistry;

    uint256 public constant LLM_AGENT_ID = 12875401142070969085;
    address public immutable settledStatusEmitter;

    mapping(uint256 => PendingVerification) private _pendingByRequest;

    event PaymentVerified(bytes32 indexed intentId, bytes32 verificationHash, address verifier);
    event VerificationFailed(bytes32 indexed intentId, string reason);

    constructor(
        address _agentPlatform,
        address _intentRegistry,
        address _receiptRegistry,
        address _settledStatusEmitter
    ) Ownable(msg.sender) {
        agentPlatform = IAgentPlatform(_agentPlatform);
        intentRegistry = PaymentIntentRegistry(_intentRegistry);
        receiptRegistry = PaymentReceiptRegistry(_receiptRegistry);
        settledStatusEmitter = _settledStatusEmitter;
    }

    function initSubscription() external onlyOwner {
        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [
                keccak256("StatusUpdated(bytes32,uint8,uint8)"),
                bytes32(uint256(uint8(PaymentLib.Status.SETTLED))),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: settledStatusEmitter
        });

        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 0,
            maxFeePerGas: 20e9,
            gasLimit: 10_000_000
        });

        SomniaExtensions.subscribe(address(this), filter, opts);
    }

    function _onEvent(
        address,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        bytes32 intentId = eventTopics.length > 1 ? eventTopics[1] : bytes32(data[:32]);
        _requestVerification(intentId);
    }

    function _requestVerification(bytes32 intentId) internal {
        (PaymentLib.PaymentIntent memory intent, PaymentLib.Recipient[] memory recipients) =
            intentRegistry.getIntent(intentId);

        if (intent.status != PaymentLib.Status.SETTLED) {
            return;
        }

        string memory intentJson = _buildVerificationPrompt(intentId, intent, recipients);

        string[] memory allowedValues = new string[](2);
        allowedValues[0] = "valid";
        allowedValues[1] = "invalid";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            "You are a payment settlement verifier for ZaZaPay on Somnia. Given a payment intent and its recipients, verify that: (1) all BPS values sum to 10000, (2) each recipient has a valid non-zero address, (3) the total amount is positive. Respond only with 'valid' or 'invalid'.",
            intentJson,
            allowedValues
        );

        uint256 deposit = agentPlatform.getRequestDeposit();

        uint256 requestId = agentPlatform.createRequest{value: deposit}(
            LLM_AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );

        _pendingByRequest[requestId] = PendingVerification({intentId: intentId, exists: true});
    }

    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(agentPlatform), "VerifierGateway: unauthorized");

        PendingVerification memory pending = _pendingByRequest[requestId];
        require(pending.exists, "VerifierGateway: unknown request");
        delete _pendingByRequest[requestId];

        bytes32 intentId = pending.intentId;

        if (status == ResponseStatus.TimedOut || status == ResponseStatus.Failed) {
            intentRegistry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit VerificationFailed(intentId, status == ResponseStatus.TimedOut ? "agent_timeout" : "agent_failed");
            return;
        }

        if (responses.length == 0) {
            intentRegistry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit VerificationFailed(intentId, "no_response");
            return;
        }

        string memory result = abi.decode(responses[0].result, (string));

        if (keccak256(bytes(result)) == keccak256(bytes("valid"))) {
            intentRegistry.updateStatus(intentId, PaymentLib.Status.VERIFIED);

            bytes32 verificationHash = keccak256(abi.encodePacked(intentId, block.timestamp, address(this)));

            receiptRegistry.verifyReceipt(intentId);

            emit PaymentVerified(intentId, verificationHash, address(this));
        } else {
            intentRegistry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit VerificationFailed(intentId, "llm_invalid");
        }
    }

    function _buildVerificationPrompt(
        bytes32 intentId,
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
            '{"intentId":"', _bytes32ToHex(intentId),
            '","amount":', _uint2str(intent.amount),
            ',"recipients":', recipientsJson, "}"
        ));
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }

    function _bytes32ToHex(bytes32 b) internal pure returns (string memory) {
        bytes memory hex_ = new bytes(64);
        bytes memory alphabet = "0123456789abcdef";
        for (uint256 i = 0; i < 32; i++) {
            hex_[i * 2]     = alphabet[uint8(b[i] >> 4)];
            hex_[i * 2 + 1] = alphabet[uint8(b[i] & 0x0f)];
        }
        return string(hex_);
    }

    receive() external payable {}
}
