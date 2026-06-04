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


// File contracts/core/PaymentReceiptRegistry.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.30;

interface IAgentRegistry {
    function isActiveAgent(address agent) external view returns (bool);
}

contract PaymentReceiptRegistry is Ownable {
    struct Receipt {
        bytes32 intentId;
        address executor;
        address verifier;
        bytes32 txHash;
        uint256 amount;
        uint256 recipientCount;
        bool verified;
        uint256 timestamp;
        bytes32 receiptHash;
    }

    IAgentRegistry public immutable agentRegistry;
    address public settlementEngine;

    mapping(bytes32 => Receipt) private receipts;
    mapping(bytes32 => bool) private receiptExists;

    event ReceiptCreated(
        bytes32 indexed intentId,
        address indexed executor,
        bytes32 receiptHash,
        uint256 timestamp
    );

    event ReceiptVerified(
        bytes32 indexed intentId,
        address indexed verifier,
        bytes32 receiptHash,
        uint256 timestamp
    );

    error OnlySettlementEngine();
    error NotActiveAgent();
    error ReceiptAlreadyExists(bytes32 intentId);
    error ReceiptNotFound(bytes32 intentId);
    error ReceiptAlreadyVerified(bytes32 intentId);
    error SettlementEngineNotSet();

    modifier onlySettlementEngine() {
        if (settlementEngine == address(0)) revert SettlementEngineNotSet();
        if (msg.sender != settlementEngine) revert OnlySettlementEngine();
        _;
    }

    modifier onlyActiveAgent() {
        if (!agentRegistry.isActiveAgent(msg.sender)) revert NotActiveAgent();
        _;
    }

    constructor(address _agentRegistry) Ownable(msg.sender) {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    function setSettlementEngine(address _settlementEngine) external onlyOwner {
        settlementEngine = _settlementEngine;
    }

    function createReceipt(
        bytes32 intentId,
        address executor,
        bytes32 txHash,
        uint256 amount,
        uint256 recipientCount
    ) external onlySettlementEngine {
        if (receiptExists[intentId]) revert ReceiptAlreadyExists(intentId);

        bytes32 receiptHash = keccak256(
            abi.encodePacked(intentId, executor, txHash, amount, recipientCount, block.timestamp)
        );

        receipts[intentId] = Receipt({
            intentId: intentId,
            executor: executor,
            verifier: address(0),
            txHash: txHash,
            amount: amount,
            recipientCount: recipientCount,
            verified: false,
            timestamp: block.timestamp,
            receiptHash: receiptHash
        });

        receiptExists[intentId] = true;

        emit ReceiptCreated(intentId, executor, receiptHash, block.timestamp);
    }

    function verifyReceipt(bytes32 intentId) external onlyActiveAgent {
        if (!receiptExists[intentId]) revert ReceiptNotFound(intentId);
        Receipt storage receipt = receipts[intentId];
        if (receipt.verified) revert ReceiptAlreadyVerified(intentId);

        receipt.verified = true;
        receipt.verifier = msg.sender;

        emit ReceiptVerified(intentId, msg.sender, receipt.receiptHash, block.timestamp);
    }

    function getReceipt(bytes32 intentId) external view returns (Receipt memory) {
        if (!receiptExists[intentId]) revert ReceiptNotFound(intentId);
        return receipts[intentId];
    }

    function receiptExistsFor(bytes32 intentId) external view returns (bool) {
        return receiptExists[intentId];
    }
}
