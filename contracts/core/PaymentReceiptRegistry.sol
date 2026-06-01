// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";

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
