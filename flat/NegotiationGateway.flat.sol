// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaEventHandler.sol@v0.2.0

// Original license: SPDX_License_Identifier: MIT
// Copyright (c) 2026 Somnia Foundation

pragma solidity 0.8.30;

/// @notice Somnia event handler interface
/// @title ISomniaEventHandler
/// @author Somnia Foundation
interface ISomniaEventHandler {

    /**
     * @notice Default function invoked for a matching reactivity subscription filter
     * @param emitter Smart contract that emitted the EVM event log(s)
     * @param eventTopics List of event topics associated with the event (event signature being first param)
     * @param data Event data for non-indexed event arguments. May be empty if event only has indexed params
     */
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external;

}


// File @somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol@v0.2.0

// Original license: SPDX_License_Identifier: MIT
// Copyright (c) 2026 Somnia Foundation

pragma solidity 0.8.30;

/// @notice Somnia reactivity precompile interface and related data structures
/// @title ISomniaReactivityPrecompile
/// @author Somnia Foundation
interface ISomniaReactivityPrecompile {
    /// @notice Data structure representing a subscription
    struct SubscriptionData {
        // Topic filter, use 0x0 to indicate a wildcard or unused topic
        bytes32[4] eventTopics;
        //  Origin (tx.origin) filter, use address(0) to indicate a wildcard
        address origin;
        // Reserved for future use, use address(0)
        address caller;
        // Contract emitting the event filter, use address(0) to indicate a wildcard
        address emitter;
        // The address of the contract that will handle the event
        address handlerContractAddress;
        // The function selector in the handler contract, defaults to ISomniaEventHandler.onEvent
        bytes4 handlerFunctionSelector;
        // Extra fee per gas paid to validators to prioritize this event handling
        uint64 priorityFeePerGas;
        // Maximum fee per gas the subscriber is willing to pay (base fee + priority fee)
        uint64 maxFeePerGas;
        // Maximum gas that will be provisioned per subscription callback
        uint64 gasLimit;
        // Whether the event handling is guaranteed, i.e. moved to the next block if current is full
        bool isGuaranteed;
        // Whether multiple events can be coalesced into a single handling call per block
        bool isCoalesced;
    }

    /// @notice System tick emitted at the end of each block.
    /// @param blockNumber Current block number.
    event BlockTick(uint64 indexed blockNumber);

    /// @notice System tick emitted at epoch boundaries.
    /// @param epochNumber Current epoch number.
    /// @param blockNumber Current block number.
    event EpochTick(uint64 indexed epochNumber, uint64 indexed blockNumber);

    /// @notice Scheduled system event emitted at the requested timestamp.
    /// @param timestampMillis Timestamp in milliseconds.
    event Schedule(uint256 indexed timestampMillis);

    /// @notice Emitted when a new subscription is created
    /// @param subscriptionId New subscription identifier.
    /// @param owner Owner of the created subscription.
    /// @param subscriptionData Persisted subscription payload.
    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        address indexed owner,
        SubscriptionData subscriptionData
    );

    /// @notice Emitted when a subscription is removed
    /// @param subscriptionId Removed subscription identifier.
    /// @param owner Owner of the removed subscription.
    event SubscriptionRemoved(
        uint256 indexed subscriptionId,
        address indexed owner
    );

    /**
     * @notice Creates a new Solidity subscription
     * @dev Cost: SUBSCRIPTION_MANAGEMENT_GAS_COST (~210k GAS)
     * @dev The caller becomes the owner of the subscription.
     * @dev The subscription starts being active immediately.
     * @param subscriptionData Defines the parameters for the subscription incl the handler contract
     * @return subscriptionId The subscription ID assigned to the new subscription
     */
    function subscribe(
        SubscriptionData calldata subscriptionData
    ) external returns (uint256 subscriptionId);

    /**
     * @notice Cancels a Solidity event subscription
     * @dev It can only be called by the owner
     * @dev Cost: SUBSCRIPTION_MANAGEMENT_GAS_COST (~210K GAS)
     * @param subscriptionId Unique subscription identifier
     */
    function unsubscribe(uint256 subscriptionId) external;

    /**
     * @notice Gets detailed information about a specific subscription
     * @param subscriptionId The unique subscription identifier
     * @return subscriptionData The recorded subscription information
     * @return owner The owner of the subscription that can make changes and pays for invocations
     */
    function getSubscriptionInfo(
        uint256 subscriptionId
    )
        external
        view
        returns (SubscriptionData memory subscriptionData, address owner);
}


// File @somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol@v0.2.0

// Original license: SPDX_License_Identifier: MIT
// Copyright (c) 2026 Somnia Foundation

pragma solidity 0.8.30;


/// @notice The Somnia Reactivity Precompile is a privileged contract at a fixed address
/// @title SomniaExtensions
/// @author Somnia Foundation
library SomniaExtensions {
    /// @notice Topic/origin/emitter matching criteria for a subscription.
    struct SubscriptionFilter {
        bytes32[4] eventTopics;
        address origin;
        address emitter;
    }

    /// @notice Gas and fee controls for subscription callback execution.
    struct SubscriptionOptions {
        uint64 priorityFeePerGas;
        uint64 maxFeePerGas;
        uint64 gasLimit;
    }

    /// @notice Fixed address for the Somnia Reactivity Precompile.
    address public constant SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS =
        address(0x0100);
    /// @notice Minimum balance required by a subscription owner.
    uint256 public constant SUBSCRIPTION_OWNER_MINIMUM_BALANCE = 32 ether;
    /// @notice Minimum protocol base fee per gas used in fee validation.
    uint256 public constant MINIMUM_BASE_FEE_PER_GAS = 6 gwei;
    /// @notice Maximum callback gas limit allowed for a single subscription.
    uint64 public constant MAXIMUM_HANDLER_GAS_LIMIT = 200_000_000;
    /// @notice Default priority fee per gas used when callers opt into defaults.
    uint64 public constant DEFAULT_PRIORITY_FEE_PER_GAS = 0;
    /// @notice Default max fee per gas used when callers opt into defaults.
    uint64 public constant DEFAULT_MAX_FEE_PER_GAS = 20 gwei;
    /// @notice Default callback gas limit used when callers opt into defaults.
    uint64 public constant DEFAULT_HANDLER_GAS_LIMIT = 10_000_000;

    error HandlerZeroAddress();
    error EmptyFilter();
    error GasLimitZero();
    error GasLimitExceeded();
    error InvalidMaxFeePerGas();
    error InsufficientBalance();
    error TimestampInPast();
    error BlockInPast();
    error UnsubscribeFailed();

    /// @notice Creates a subscription owned by the caller using filter and gas options.
    /// @param handler Address of the handler contract that receives callbacks.
    /// @param filter Filter criteria for matching logs.
    /// @param options Fee and gas options for callback execution.
    /// @return subscriptionId Newly created subscription identifier.
    function subscribe(
        address handler,
        SubscriptionFilter memory filter,
        SubscriptionOptions memory options
    ) internal returns (uint256 subscriptionId) {
        return _subscribe(handler, filter, options);
    }

    /// @notice Creates a schedule subscription for an absolute millisecond timestamp.
    /// @param handler Address of the handler contract that receives callbacks.
    /// @param timestampMillis Absolute unix timestamp in milliseconds.
    /// @param options Fee and gas options for callback execution.
    /// @return subscriptionId Newly created subscription identifier.
    function scheduleSubscriptionAtTimestamp(
        address handler,
        uint256 timestampMillis,
        SubscriptionOptions memory options
    ) internal returns (uint256 subscriptionId) {
        if (timestampMillis < ((block.timestamp + 1) * 1000) + 1) {
            revert TimestampInPast();
        }

        SubscriptionFilter memory filter = SubscriptionFilter({
            eventTopics: [
                ISomniaReactivityPrecompile.Schedule.selector,
                bytes32(timestampMillis),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS
        });

        return _subscribe(handler, filter, options);
    }

    /// @notice Creates a subscription triggered at a specific future block.
    /// @param handler Address of the handler contract that receives callbacks.
    /// @param blockNumber Future block number to trigger on.
    /// @param options Fee and gas options for callback execution.
    /// @return subscriptionId Newly created subscription identifier.
    function scheduleSubscriptionAtBlock(
        address handler,
        uint64 blockNumber,
        SubscriptionOptions memory options
    ) internal returns (uint256 subscriptionId) {
        if (blockNumber < block.number + 1) {
            revert BlockInPast();
        }

        SubscriptionFilter memory filter = SubscriptionFilter({
            eventTopics: [
                ISomniaReactivityPrecompile.BlockTick.selector,
                bytes32(uint256(blockNumber)),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS
        });

        return _subscribe(handler, filter, options);
    }

    /// @notice Creates a subscription triggered at a specific epoch.
    /// @param handler Address of the handler contract that receives callbacks.
    /// @param epochNumber Epoch number to trigger on.
    /// @param options Fee and gas options for callback execution.
    /// @return subscriptionId Newly created subscription identifier.
    function scheduleSubscriptionAtEpoch(
        address handler,
        uint64 epochNumber,
        SubscriptionOptions memory options
    ) internal returns (uint256 subscriptionId) {
        SubscriptionFilter memory filter = SubscriptionFilter({
            eventTopics: [
                ISomniaReactivityPrecompile.EpochTick.selector,
                bytes32(uint256(epochNumber)),
                bytes32(0),
                bytes32(0)
            ],
            origin: address(0),
            emitter: SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS
        });

        return _subscribe(handler, filter, options);
    }

    /// @notice Cancels a subscription.
    /// @param subscriptionId Existing subscription identifier.
    function unsubscribe(uint256 subscriptionId) internal {
        // Low-level call used to bypass false positives from Solidity safety checks
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS.call(
            abi.encodeWithSelector(ISomniaReactivityPrecompile.unsubscribe.selector, subscriptionId)
        );
        if (!success) revert UnsubscribeFailed();
    }

    /// @notice Fetches subscription details and owner for a subscription id.
    /// @param subscriptionId Existing subscription identifier.
    /// @return subscriptionData Stored subscription parameters.
    /// @return owner Address currently owning the subscription.
    function getSubscriptionInfo(
        uint256 subscriptionId
    )
        internal
        view
        returns (
            ISomniaReactivityPrecompile.SubscriptionData
                memory subscriptionData,
            address owner
        )
    {
        return
            ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS)
                .getSubscriptionInfo(subscriptionId);
    }

    /// @notice Returns the library default fee and gas options for subscriptions.
    /// @return options Default subscription options struct.
    function defaultSubscriptionOptions()
        internal
        pure
        returns (SubscriptionOptions memory options)
    {
        return
            SubscriptionOptions({
                priorityFeePerGas: DEFAULT_PRIORITY_FEE_PER_GAS,
                maxFeePerGas: DEFAULT_MAX_FEE_PER_GAS,
                gasLimit: DEFAULT_HANDLER_GAS_LIMIT
            });
    }

    /// @dev Internal helper used by all public subscription creation functions.
    function _subscribe(
        address handler,
        SubscriptionFilter memory filter,
        SubscriptionOptions memory options
    ) private returns (uint256 subscriptionId) {
        if (handler == address(0)) {
            revert HandlerZeroAddress();
        }
        if (!_hasAnyFilter(filter)) {
            revert EmptyFilter();
        }
        if (options.gasLimit == 0) {
            revert GasLimitZero();
        }
        if (options.gasLimit > MAXIMUM_HANDLER_GAS_LIMIT) {
            revert GasLimitExceeded();
        }
        if (
            options.maxFeePerGas != 0 &&
            options.priorityFeePerGas + MINIMUM_BASE_FEE_PER_GAS  >
            options.maxFeePerGas
        ) {
            revert InvalidMaxFeePerGas();
        }
        if (address(this).balance < SUBSCRIPTION_OWNER_MINIMUM_BALANCE) {
            revert InsufficientBalance();
        }

        return
            ISomniaReactivityPrecompile(SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS)
                .subscribe(_buildSubscriptionData(handler, filter, options));
    }

    /// @dev Returns true when at least one filter criterion is non-wildcard.
    function _hasAnyFilter(
        SubscriptionFilter memory filter
    ) private pure returns (bool hasAnyFilter) {
        return
            filter.origin != address(0) ||
            filter.emitter != address(0) ||
            filter.eventTopics[0] != bytes32(0) ||
            filter.eventTopics[1] != bytes32(0) ||
            filter.eventTopics[2] != bytes32(0) ||
            filter.eventTopics[3] != bytes32(0);
    }

    /// @dev Builds low-level precompile subscription payload from high-level inputs.
    function _buildSubscriptionData(
        address handler,
        SubscriptionFilter memory filter,
        SubscriptionOptions memory options
    )
        private
        pure
        returns (
            ISomniaReactivityPrecompile.SubscriptionData memory subscriptionData
        )
    {
        ISomniaReactivityPrecompile.SubscriptionData
            memory data = ISomniaReactivityPrecompile.SubscriptionData({
                eventTopics: filter.eventTopics,
                origin: filter.origin,
                caller: address(0),
                emitter: filter.emitter,
                handlerContractAddress: handler,
                handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
                priorityFeePerGas: options.priorityFeePerGas,
                maxFeePerGas: options.maxFeePerGas,
                gasLimit: options.gasLimit,
                isGuaranteed: false,
                isCoalesced: false
            });

        return data;
    }
}


// File @somnia-chain/reactivity-contracts/contracts/interfaces/IERC165.sol@v0.2.0

// Original license: SPDX_License_Identifier: MIT

pragma solidity 0.8.30;

/// @title IERC165
/// @author Somnia Foundation
/// @notice ERC-165 interface detection standard interface.
interface IERC165 {
    /// @notice Returns true if this contract implements the interface defined by `interfaceId`.
    /// @param interfaceId Interface identifier, as specified in ERC-165.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}


// File @somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol@v0.2.0

// Original license: SPDX_License_Identifier: MIT
// Copyright (c) 2026 Somnia Foundation

pragma solidity 0.8.30;



/// @notice Abstract smart contract implementing native on-chain reactivity safely with reduced boilerplate
/// @dev The _onEvent virtual method must be overridden to define logic executed when subscription callbacks are invoked by the chain
/// @dev The contract is deemed upgrade safe due to the absence of storage variables
/// @title SomniaEventHandler
/// @author Somnia Foundation
abstract contract SomniaEventHandler is IERC165, ISomniaEventHandler {
    error OnlyReactivityPrecompile();

    /// @inheritdoc ISomniaEventHandler
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external override {
        // Ensure only privileged execution is permitted since the receiving contract may execute its own side effects i.e. releasing prize money
        require(
            msg.sender == SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS,
            OnlyReactivityPrecompile()
        );
        _onEvent(emitter, eventTopics, data);
    }

    /// @notice Returns whether this contract supports the requested interface id.
    /// @param interfaceId Interface identifier as defined by ERC-165.
    /// @dev Allows the Somnia reactivity precompile to reason about support for reactivity subscriptions.
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return type(IERC165).interfaceId == interfaceId
            || type(ISomniaEventHandler).interfaceId == interfaceId;
    }

    /**
     * @notice Handles a verified callback dispatched by the reactivity precompile.
     * @dev Implementing contract must override to define what logic it wants to execute for subscription callbacks
     * @param emitter Smart contract that emitted the EVM event log
     * @param eventTopics List of event topics associated with the event (event signature being first param)
     * @param data Event data for non-indexed event arguments. May be empty if event only has indexed params
     */
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal virtual;
}


// File contracts/libraries/PaymentLib.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.30;

library PaymentLib {
    uint16 public constant BPS_DENOMINATOR = 10000;

    enum Status {
        CREATED,
        PLANNED,
        EXECUTOR_SELECTED,
        SETTLED,
        VERIFIED,
        FAILED
    }

    struct Recipient {
        string role;
        address wallet;
        uint16 bps;
    }

    struct PaymentIntent {
        bytes32 intentId;
        address payer;
        address token;
        uint256 amount;
        Recipient[] recipients;
        Status status;
        uint256 createdAt;
        uint256 deadline;
        string context;
        address selectedExecutor;
        uint256 executorFee;
    }

    error BpsMismatch(uint256 total);

    function validateBps(Recipient[] memory recipients) internal pure {
        uint256 total;
        for (uint256 i; i < recipients.length; ++i) {
            total += recipients[i].bps;
        }
        if (total != BPS_DENOMINATOR) revert BpsMismatch(total);
    }

    function bpsAmount(uint256 total, uint16 bps) internal pure returns (uint256) {
        return (total * bps) / BPS_DENOMINATOR;
    }
}


// File contracts/core/NegotiationGateway.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.30;




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
            maxFeePerGas: 100_000_000_000,
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
