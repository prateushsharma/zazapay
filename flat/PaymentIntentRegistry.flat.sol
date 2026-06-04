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


// File contracts/core/PaymentIntentRegistry.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.30;


contract PaymentIntentRegistry is Ownable {
    using PaymentLib for PaymentLib.Recipient[];

    mapping(bytes32 => PaymentLib.PaymentIntent) private _intents;
    mapping(bytes32 => PaymentLib.Recipient[]) private _recipients;

    mapping(address => bool) public authorizedCallers;

    event PaymentIntentCreated(bytes32 indexed intentId, address indexed payer, uint256 amount);
    event StatusUpdated(bytes32 indexed intentId, PaymentLib.Status newStatus);
    event AuthorizedCallerSet(address indexed caller, bool authorized);

    error IntentAlreadyExists(bytes32 intentId);
    error IntentNotFound(bytes32 intentId);
    error InvalidStatusTransition(PaymentLib.Status current, PaymentLib.Status next);
    error DeadlineInPast();
    error NotAuthorized();

    modifier onlyAuthorized() {
        if (msg.sender != owner() && !authorizedCallers[msg.sender]) revert NotAuthorized();
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setAuthorizedCaller(address _caller, bool _authorized) external onlyOwner {
        authorizedCallers[_caller] = _authorized;
        emit AuthorizedCallerSet(_caller, _authorized);
    }

    function createIntent(
        address token,
        uint256 amount,
        PaymentLib.Recipient[] calldata recipients,
        uint256 deadline,
        string calldata context
    ) external returns (bytes32 intentId) {
        if (deadline <= block.timestamp) revert DeadlineInPast();
        PaymentLib.validateBps(recipients);

        intentId = keccak256(
            abi.encodePacked(msg.sender, token, amount, block.timestamp, block.prevrandao)
        );

        if (_intents[intentId].createdAt != 0) revert IntentAlreadyExists(intentId);

        PaymentLib.PaymentIntent storage intent = _intents[intentId];
        intent.intentId = intentId;
        intent.payer = msg.sender;
        intent.token = token;
        intent.amount = amount;
        intent.status = PaymentLib.Status.CREATED;
        intent.createdAt = block.timestamp;
        intent.deadline = deadline;
        intent.context = context;

        for (uint256 i; i < recipients.length; ++i) {
            _recipients[intentId].push(recipients[i]);
        }

        emit PaymentIntentCreated(intentId, msg.sender, amount);
        emit StatusUpdated(intentId, PaymentLib.Status.CREATED);
    }

    function setSelectedExecutor(bytes32 intentId, address executor, uint256 fee) external onlyAuthorized {
        if (_intents[intentId].createdAt == 0) revert IntentNotFound(intentId);
        _intents[intentId].selectedExecutor = executor;
        _intents[intentId].executorFee = fee;
    }

    function updateStatus(bytes32 intentId, PaymentLib.Status newStatus) external onlyAuthorized {
        PaymentLib.PaymentIntent storage intent = _intents[intentId];
        if (intent.createdAt == 0) revert IntentNotFound(intentId);
        _validateTransition(intent.status, newStatus);
        intent.status = newStatus;
        emit StatusUpdated(intentId, newStatus);
    }

    function getIntent(
        bytes32 intentId
    ) external view returns (PaymentLib.PaymentIntent memory intent, PaymentLib.Recipient[] memory recipients) {
        if (_intents[intentId].createdAt == 0) revert IntentNotFound(intentId);
        intent = _intents[intentId];
        recipients = _recipients[intentId];
    }

    function getStatus(bytes32 intentId) external view returns (PaymentLib.Status) {
        if (_intents[intentId].createdAt == 0) revert IntentNotFound(intentId);
        return _intents[intentId].status;
    }

    function _validateTransition(PaymentLib.Status current, PaymentLib.Status next) internal pure {
        if (current == PaymentLib.Status.CREATED && next == PaymentLib.Status.PLANNED) return;
        if (current == PaymentLib.Status.PLANNED && next == PaymentLib.Status.EXECUTOR_SELECTED) return;
        if (current == PaymentLib.Status.EXECUTOR_SELECTED && next == PaymentLib.Status.SETTLED) return;
        if (current == PaymentLib.Status.SETTLED && next == PaymentLib.Status.VERIFIED) return;
        if (
            (current == PaymentLib.Status.CREATED ||
                current == PaymentLib.Status.PLANNED ||
                current == PaymentLib.Status.EXECUTOR_SELECTED) &&
            next == PaymentLib.Status.FAILED
        ) return;
        revert InvalidStatusTransition(current, next);
    }
}
