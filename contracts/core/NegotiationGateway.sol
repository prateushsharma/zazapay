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

    function setSelectedExecutor(bytes32 intentId, address executor, uint256 fee) external;
}

interface IAgentRegistry {
    function isActiveAgent(address agent) external view returns (bool);

    function getActiveExecutors() external view returns (address[] memory);
}

interface IJsonApiAgent {
    function fetchUint(
        string calldata url,
        string calldata selector,
        uint8 decimals
    ) external returns (uint256);
}

contract NegotiationGateway is SomniaEventHandler, Ownable {
    IAgentRequester public immutable platform;
    IPaymentIntentRegistry public immutable registry;
    IAgentRegistry public immutable agentRegistry;

    uint256 public constant JSON_API_AGENT_ID = 12847293847561029384;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant JSON_FETCH_COST_PER_AGENT = 0.03 ether;

    string public executorQuoteFeedUrl;

    struct NegotiationState {
        bytes32 intentId;
        address[] candidates;
        uint256 quoteIndex;
        uint256 bestFee;
        address bestExecutor;
        bool active;
    }

    mapping(uint256 => NegotiationState) private _requestState;
    mapping(bytes32 => bool) private _pendingIntents;

    uint256 private _subscriptionId;

    event ExecutorSelected(bytes32 indexed intentId, address executor, uint256 quotedFee);
    event NegotiationFailed(bytes32 indexed intentId, string reason);

    error OnlyPlatform();
    error UnknownRequest(uint256 requestId);

    address private _registryAddress;

    constructor(
        address platform_,
        address paymentIntentRegistry_,
        address agentRegistry_,
        string memory executorQuoteFeedUrl_
    ) Ownable(msg.sender) {
        platform = IAgentRequester(platform_);
        registry = IPaymentIntentRegistry(paymentIntentRegistry_);
        agentRegistry = IAgentRegistry(agentRegistry_);
        executorQuoteFeedUrl = executorQuoteFeedUrl_;
        _registryAddress = paymentIntentRegistry_;
    }

    function initSubscription() external onlyOwner {
        bytes32[4] memory topics;
        topics[0] = keccak256("StatusUpdated(bytes32,uint8)");
        topics[1] = bytes32(uint256(PaymentLib.Status.PLANNED));

        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: topics,
            origin: address(0),
            emitter: _registryAddress
        });

        SomniaExtensions.SubscriptionOptions memory options = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 1_000_000_000,
            maxFeePerGas: 10_000_000_000,
            gasLimit: 3_000_000
        });

        _subscriptionId = SomniaExtensions.subscribe(address(this), filter, options);
    }

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (emitter != address(registry)) return;
        if (eventTopics.length < 2) return;
        if (eventTopics[0] != keccak256("StatusUpdated(bytes32,uint8)")) return;
        uint8 newStatus = abi.decode(data, (uint8));
        if (newStatus != uint8(PaymentLib.Status.PLANNED)) return;

        bytes32 intentId = eventTopics[1];

        if (_pendingIntents[intentId]) return;

        address[] memory candidates = agentRegistry.getActiveExecutors();
        if (candidates.length == 0) {
            registry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit NegotiationFailed(intentId, "no active executors");
            return;
        }

        _pendingIntents[intentId] = true;
        _kickoffQuoteRound(intentId, candidates, 0, type(uint256).max, address(0));
    }

    function _kickoffQuoteRound(
        bytes32 intentId,
        address[] memory candidates,
        uint256 quoteIndex,
        uint256 bestFee,
        address bestExecutor
    ) internal {
        if (quoteIndex >= candidates.length) {
            _finalizeNegotiation(intentId, bestFee, bestExecutor);
            return;
        }

        address candidate = candidates[quoteIndex];
        string memory url = string(abi.encodePacked(
            executorQuoteFeedUrl, "/", _addressToHex(candidate), "/fee"
        ));

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            url,
            "fee",
            uint8(18)
        );

        uint256 reserve = platform.getRequestDeposit();
        uint256 deposit = reserve + (JSON_FETCH_COST_PER_AGENT * SUBCOMMITTEE_SIZE);

        if (address(this).balance < deposit) {
            if (bestExecutor != address(0)) {
                _finalizeNegotiation(intentId, bestFee, bestExecutor);
            } else {
                _pendingIntents[intentId] = false;
                registry.updateStatus(intentId, PaymentLib.Status.FAILED);
                emit NegotiationFailed(intentId, "insufficient balance for quotes");
            }
            return;
        }

        uint256 requestId = platform.createRequest{value: deposit}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleNegotiationResponse.selector,
            payload
        );

        NegotiationState storage state = _requestState[requestId];
        state.intentId = intentId;
        state.candidates = candidates;
        state.quoteIndex = quoteIndex;
        state.bestFee = bestFee;
        state.bestExecutor = bestExecutor;
        state.active = true;
    }

    function handleNegotiationResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        if (msg.sender != address(platform)) revert OnlyPlatform();

        NegotiationState storage state = _requestState[requestId];
        if (!state.active) revert UnknownRequest(requestId);

        bytes32 intentId = state.intentId;
        address[] memory candidates = state.candidates;
        uint256 quoteIndex = state.quoteIndex;
        uint256 bestFee = state.bestFee;
        address bestExecutor = state.bestExecutor;

        delete _requestState[requestId];

        address candidate = candidates[quoteIndex];

        if (status == ResponseStatus.Success && responses.length > 0) {
            uint256 quotedFee = abi.decode(responses[0].result, (uint256));
            if (quotedFee < bestFee) {
                bestFee = quotedFee;
                bestExecutor = candidate;
            }
        }

        uint256 nextIndex = quoteIndex + 1;
        if (nextIndex < candidates.length) {
            _kickoffQuoteRound(intentId, candidates, nextIndex, bestFee, bestExecutor);
        } else {
            _finalizeNegotiation(intentId, bestFee, bestExecutor);
        }
    }

    function _finalizeNegotiation(
        bytes32 intentId,
        uint256 bestFee,
        address bestExecutor
    ) internal {
        _pendingIntents[intentId] = false;

        if (bestExecutor == address(0)) {
            registry.updateStatus(intentId, PaymentLib.Status.FAILED);
            emit NegotiationFailed(intentId, "no executor quoted");
            return;
        }

        registry.setSelectedExecutor(intentId, bestExecutor, bestFee);
        registry.updateStatus(intentId, PaymentLib.Status.EXECUTOR_SELECTED);

        emit ExecutorSelected(intentId, bestExecutor, bestFee);
    }

    function setExecutorQuoteFeedUrl(string calldata url) external onlyOwner {
        executorQuoteFeedUrl = url;
    }

    function cancelSubscription() external onlyOwner {
        SomniaExtensions.unsubscribe(_subscriptionId);
    }

    function withdrawFunds(address to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }

    function _addressToHex(address a) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0"; str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = hexChars[uint8(bytes20(a)[i] >> 4)];
            str[3 + i * 2] = hexChars[uint8(bytes20(a)[i] & 0x0f)];
        }
        return string(str);
    }

    receive() external payable {}
}
