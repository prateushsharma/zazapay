// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
