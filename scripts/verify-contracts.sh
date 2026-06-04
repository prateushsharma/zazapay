#!/usr/bin/env bash
set -e

NETWORK=somnia

echo "Verifying PaymentIntentRegistry..."
npx hardhat verify --network $NETWORK 0xf7b4f680aaddab9247423e1d833e038c760aa1e6

echo "Verifying AgentRegistry..."
npx hardhat verify --network $NETWORK 0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7

echo "Verifying PaymentReceiptRegistry..."
npx hardhat verify --network $NETWORK 0xec7e01574cbcaEcC7cEaDDa6fcA4BA4cfA334503 \
  "0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7"

echo "Verifying MockERC20..."
npx hardhat verify --network $NETWORK 0x286f0E199804F1d2F4936A327590f9AECb262086 \
  "ZaZaPay Test Token" "ZZP" 18

echo "Verifying SettlementEngine..."
npx hardhat verify --network $NETWORK 0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf \
  "0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7" \
  "0xf7b4f680aaddab9247423e1d833e038c760aa1e6"

echo "Verifying PlannerGateway..."
npx hardhat verify --network $NETWORK 0xc156d8137b8a9b0de18d4001a75e9448e3d3ea6b \
  "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" \
  "0xf7b4f680aaddab9247423e1d833e038c760aa1e6"

echo "Verifying NegotiationGateway..."
npx hardhat verify --network $NETWORK 0x40c35f825ba88b84ad23a2f3642f4d8a19b2e8f5 \
  "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" \
  "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" \
  "0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7" \
  "https://api.zazapay.io/executor-quotes"

echo "Verifying VerifierGateway..."
npx hardhat verify --network $NETWORK 0x454e26a4a621cbf271d03a5c55053c71b846e408 \
  "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" \
  "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" \
  "0xec7e01574cbcaEcC7cEaDDa6fcA4BA4cfA334503" \
  "0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf"

echo "All contracts verified."
