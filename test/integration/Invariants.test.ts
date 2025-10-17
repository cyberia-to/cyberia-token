import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { mine as _mine } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Invariant and Property-Based Tests
 *
 * These tests verify mathematical invariants and properties that should ALWAYS hold true,
 * regardless of the sequence of operations performed on the contract.
 */
describe("Invariant and Property-Based Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let pool: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, treasury, user1, user2, user3, pool] = await ethers.getSigners();

    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Distribute tokens
    await cap.connect(owner).transfer(user1.address, ethers.parseEther("100000"));
    await cap.connect(owner).transfer(user2.address, ethers.parseEther("100000"));
    await cap.connect(owner).transfer(user3.address, ethers.parseEther("100000"));
  });

  describe("Supply Invariants", function () {
    it("INVARIANT: Total supply should equal sum of all balances", async function () {
      const addresses = [owner.address, treasury.address, user1.address, user2.address, user3.address];

      const totalSupply = await cap.totalSupply();
      let sumOfBalances = 0n;

      for (const addr of addresses) {
        sumOfBalances += await cap.balanceOf(addr);
      }

      expect(sumOfBalances).to.equal(totalSupply);

      // Perform random operations
      await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
      await cap.connect(user2).transfer(user3.address, ethers.parseEther("500"));

      // Re-verify invariant
      const newTotalSupply = await cap.totalSupply();
      let newSumOfBalances = 0n;

      for (const addr of addresses) {
        newSumOfBalances += await cap.balanceOf(addr);
      }

      expect(newSumOfBalances).to.equal(newTotalSupply);
    });

    it("INVARIANT: Total supply should never exceed MAX_SUPPLY", async function () {
      const maxSupply = await cap.MAX_SUPPLY();
      const currentSupply = await cap.totalSupply();

      expect(currentSupply).to.be.lte(maxSupply);

      // Test that we cannot propose minting beyond MAX_SUPPLY
      const remainingSupply = maxSupply - currentSupply;
      await expect(cap.connect(owner).proposeMint(user1.address, remainingSupply + 1n)).to.be.revertedWith(
        "EXCEEDS_MAX_SUPPLY"
      );

      // Mint within rate limit (100M per 30 days)
      const mintAmount = ethers.parseEther("50000000"); // 50M tokens
      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days for mint timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).executeMint();

      const newSupply = await cap.totalSupply();
      expect(newSupply).to.equal(currentSupply + mintAmount);
      expect(newSupply).to.be.lte(maxSupply);
    });

    it("INVARIANT: Burning reduces total supply by exact amount", async function () {
      const initialSupply = await cap.totalSupply();
      const burnAmount = ethers.parseEther("1000");

      await cap.connect(user1).burn(burnAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("INVARIANT: Minting increases total supply by exact amount", async function () {
      const initialSupply = await cap.totalSupply();
      const mintAmount = ethers.parseEther("50000");

      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days for mint timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).executeMint();

      expect(await cap.totalSupply()).to.equal(initialSupply + mintAmount);
    });

    it("INVARIANT: Tax burns should reduce total supply", async function () {
      // Set fee recipient to zero address (burn mode)
      await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);

      const initialSupply = await cap.totalSupply();
      const transferAmount = ethers.parseEther("10000");
      const expectedTax = (transferAmount * 100n) / 10000n; // 1%

      await cap.connect(user1).transfer(user2.address, transferAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply - expectedTax);
    });
  });

  describe("Balance Invariants", function () {
    it("INVARIANT: Balance changes should sum to zero (conservation of tokens)", async function () {
      const user1Before = await cap.balanceOf(user1.address);
      const user2Before = await cap.balanceOf(user2.address);
      const treasuryBefore = await cap.balanceOf(treasury.address);

      const transferAmount = ethers.parseEther("1000");

      await cap.connect(user1).transfer(user2.address, transferAmount);

      const user1After = await cap.balanceOf(user1.address);
      const user2After = await cap.balanceOf(user2.address);
      const treasuryAfter = await cap.balanceOf(treasury.address);

      // Sum of changes should be zero (with tax going to treasury)
      const user1Change = user1After - user1Before; // Negative
      const user2Change = user2After - user2Before; // Positive
      const treasuryChange = treasuryAfter - treasuryBefore; // Positive (tax)

      expect(user1Change + user2Change + treasuryChange).to.equal(0);
    });

    it("INVARIANT: Sender balance should decrease by transfer amount", async function () {
      const user1Before = await cap.balanceOf(user1.address);
      const transferAmount = ethers.parseEther("5000");

      await cap.connect(user1).transfer(user2.address, transferAmount);

      const user1After = await cap.balanceOf(user1.address);

      expect(user1Before - user1After).to.equal(transferAmount);
    });

    it("INVARIANT: Balance can never exceed total supply", async function () {
      const addresses = [owner, user1, user2, user3, treasury];

      for (const signer of addresses) {
        const balance = await cap.balanceOf(signer.address);
        const totalSupply = await cap.totalSupply();
        expect(balance).to.be.lte(totalSupply);
      }
    });

    it("INVARIANT: Balance cannot go negative (should revert)", async function () {
      const balance = await cap.balanceOf(user1.address);

      await expect(cap.connect(user1).transfer(user2.address, balance + 1n)).to.be.revertedWithCustomError(
        cap,
        "ERC20InsufficientBalance"
      );
    });
  });

  describe("Tax Calculation Invariants", function () {
    it("INVARIANT: Tax amount should be deterministic for same inputs", async function () {
      const transferAmount = ethers.parseEther("1000");

      // Transfer 1
      const treasuryBefore1 = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(user2.address, transferAmount);
      const treasuryAfter1 = await cap.balanceOf(treasury.address);
      const tax1 = treasuryAfter1 - treasuryBefore1;

      // Transfer 2 (same amount)
      const treasuryBefore2 = await cap.balanceOf(treasury.address);
      await cap.connect(user2).transfer(user3.address, transferAmount);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);
      const tax2 = treasuryAfter2 - treasuryBefore2;

      expect(tax1).to.equal(tax2);
    });

    it("INVARIANT: Tax should scale linearly with transfer amount", async function () {
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("2000");

      // Transfer 1000
      const treasuryBefore1 = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(user2.address, amount1);
      const treasuryAfter1 = await cap.balanceOf(treasury.address);
      const tax1 = treasuryAfter1 - treasuryBefore1;

      // Transfer 2000 (2x amount)
      const treasuryBefore2 = await cap.balanceOf(treasury.address);
      await cap.connect(user2).transfer(user3.address, amount2);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);
      const tax2 = treasuryAfter2 - treasuryBefore2;

      // Tax should be exactly 2x
      expect(tax2).to.equal(tax1 * 2n);
    });

    it("INVARIANT: Received amount + tax should equal sent amount", async function () {
      const transferAmount = ethers.parseEther("10000");

      const user1Before = await cap.balanceOf(user1.address);
      const user2Before = await cap.balanceOf(user2.address);
      const treasuryBefore = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(user2.address, transferAmount);

      const user1After = await cap.balanceOf(user1.address);
      const user2After = await cap.balanceOf(user2.address);
      const treasuryAfter = await cap.balanceOf(treasury.address);

      const sent = user1Before - user1After;
      const received = user2After - user2Before;
      const taxed = treasuryAfter - treasuryBefore;

      expect(received + taxed).to.equal(sent);
    });

    it("INVARIANT: Tax rate should never exceed configured maximum", async function () {
      // Set maximum allowed taxes (respecting combined cap of 800)
      await cap.connect(owner).proposeTaxChange(400, 400, 500); // 4% + 4% = 8% combined for sells, 5% for buys
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).applyTaxChange();

      const transferAmount = ethers.parseEther("10000");

      // Regular transfer
      const treasuryBefore = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(user2.address, transferAmount);
      const treasuryAfter = await cap.balanceOf(treasury.address);

      const tax = treasuryAfter - treasuryBefore;
      const maxPossibleTax = (transferAmount * 400n) / 10000n; // 4%

      expect(tax).to.be.lte(maxPossibleTax);
    });

    it("INVARIANT: Pool transfers should apply correct tax combination", async function () {
      await cap.connect(owner).addPool(pool.address);

      const transferAmount = ethers.parseEther("10000");
      const transferTax = await cap.transferTaxBp();
      const sellTax = await cap.sellTaxBp();
      const _buyTax = await cap.buyTaxBp();

      // Sell to pool (transfer + sell tax)
      const treasuryBefore = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(pool.address, transferAmount);
      const treasuryAfter = await cap.balanceOf(treasury.address);

      const expectedSellTax = (transferAmount * (transferTax + sellTax)) / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedSellTax);
    });
  });

  describe("Delegation Invariants", function () {
    it("INVARIANT: Total delegated votes should equal total delegating balances", async function () {
      // Users delegate
      await cap.connect(user1).delegate(user2.address);
      await cap.connect(user2).delegate(user2.address);
      await cap.connect(user3).delegate(user2.address);

      const user1Balance = await cap.balanceOf(user1.address);
      const user2Balance = await cap.balanceOf(user2.address);
      const user3Balance = await cap.balanceOf(user3.address);

      const user2Votes = await cap.getVotes(user2.address);

      expect(user2Votes).to.equal(user1Balance + user2Balance + user3Balance);
    });

    it("INVARIANT: Delegating should not change token balance", async function () {
      const balanceBefore = await cap.balanceOf(user1.address);

      await cap.connect(user1).delegate(user2.address);

      const balanceAfter = await cap.balanceOf(user1.address);

      expect(balanceAfter).to.equal(balanceBefore);
    });

    it("INVARIANT: Votes should update when delegated balance changes", async function () {
      await cap.connect(user1).delegate(user2.address);
      await cap.connect(user2).delegate(user2.address);

      const votesBefore = await cap.getVotes(user2.address);

      // User1 transfers some tokens away
      const transferAmount = ethers.parseEther("5000");
      await cap.connect(user1).transfer(user3.address, transferAmount);

      const votesAfter = await cap.getVotes(user2.address);

      // Votes should decrease by transfer amount
      expect(votesBefore - votesAfter).to.equal(transferAmount);
    });
  });

  describe("Property-Based Tests", function () {
    it("PROPERTY: Multiple small transfers should have same total tax as one large transfer", async function () {
      const totalAmount = ethers.parseEther("10000");
      const chunks = 10n;
      const chunkAmount = totalAmount / chunks;

      // Scenario 1: Single large transfer
      const user2BalanceBefore1 = await cap.balanceOf(user2.address);
      const treasuryBalance1 = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(user2.address, totalAmount);

      const user2BalanceAfter1 = await cap.balanceOf(user2.address);
      const treasuryAfter1 = await cap.balanceOf(treasury.address);
      const tax1 = treasuryAfter1 - treasuryBalance1;
      const net1 = user2BalanceAfter1 - user2BalanceBefore1;

      // Scenario 2: Multiple small transfers (from user3 to have fresh start)
      const user2BalanceBefore2 = await cap.balanceOf(user2.address);
      const treasuryBefore2 = await cap.balanceOf(treasury.address);

      for (let i = 0n; i < chunks; i++) {
        await cap.connect(user3).transfer(user2.address, chunkAmount);
      }

      const user2BalanceAfter2 = await cap.balanceOf(user2.address);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);
      const tax2 = treasuryAfter2 - treasuryBefore2;
      const net2 = user2BalanceAfter2 - user2BalanceBefore2;

      // Total tax should be approximately equal (may differ by rounding)
      const taxDiff = tax1 > tax2 ? tax1 - tax2 : tax2 - tax1;
      expect(taxDiff).to.be.lte(chunks); // Allow for rounding differences

      // Net received amount should be approximately equal
      const receivedDiff = net1 > net2 ? net1 - net2 : net2 - net1;
      expect(receivedDiff).to.be.lte(chunks * 2n);
    });

    it("PROPERTY: Commutativity - order of transfers should not matter for final state", async function () {
      // Setup identical starting states
      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("500");

      // Scenario A: Transfer 1000 then 500
      const user1Start = await cap.balanceOf(user1.address);

      await cap.connect(user1).transfer(user2.address, amount1);
      await cap.connect(user1).transfer(user3.address, amount2);

      const user1EndA = await cap.balanceOf(user1.address);
      const totalSentA = user1Start - user1EndA;

      // Reset by getting tokens back
      const user2Balance = await cap.balanceOf(user2.address);
      const user3Balance = await cap.balanceOf(user3.address);
      await cap.connect(user2).transfer(user1.address, user2Balance);
      await cap.connect(user3).transfer(user1.address, user3Balance);

      // Scenario B: Transfer 500 then 1000 (reversed order)
      const user1Start2 = await cap.balanceOf(user1.address);

      await cap.connect(user1).transfer(user3.address, amount2);
      await cap.connect(user1).transfer(user2.address, amount1);

      const user1EndB = await cap.balanceOf(user1.address);
      const totalSentB = user1Start2 - user1EndB;

      // Total sent should be equal regardless of order
      expect(totalSentA).to.equal(totalSentB);
    });

    it("PROPERTY: Idempotence - setting same tax rates multiple times has no effect", async function () {
      const taxRates = { transfer: 200, sell: 300, buy: 50 };

      await cap.connect(owner).proposeTaxChange(taxRates.transfer, taxRates.sell, taxRates.buy);
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).applyTaxChange();

      // Propose same rates again
      await cap.connect(owner).proposeTaxChange(taxRates.transfer, taxRates.sell, taxRates.buy);
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(taxRates.transfer);
      expect(await cap.sellTaxBp()).to.equal(taxRates.sell);
      expect(await cap.buyTaxBp()).to.equal(taxRates.buy);

      // Tax calculation should be the same
      const transferAmount = ethers.parseEther("1000");
      const treasuryBefore = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(user2.address, transferAmount);

      const treasuryAfter = await cap.balanceOf(treasury.address);
      const expectedTax = (transferAmount * BigInt(taxRates.transfer)) / 10000n;

      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax);
    });

    it("PROPERTY: Monotonicity - tax should always increase with amount", async function () {
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("500"),
        ethers.parseEther("1000"),
        ethers.parseEther("5000"),
      ];

      const taxes: bigint[] = [];

      for (const amount of amounts) {
        const treasuryBefore = await cap.balanceOf(treasury.address);
        await cap.connect(user1).transfer(user2.address, amount);
        const treasuryAfter = await cap.balanceOf(treasury.address);
        taxes.push(treasuryAfter - treasuryBefore);
      }

      // Each tax should be strictly greater than the previous
      for (let i = 1; i < taxes.length; i++) {
        expect(taxes[i]).to.be.gt(taxes[i - 1]);
      }
    });
  });

  describe("State Transition Invariants", function () {
    it("INVARIANT: Contract state should be consistent after any sequence of operations", async function () {
      // Perform random sequence of operations
      await cap.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
      await cap.connect(owner).proposeTaxChange(200, 300, 100);
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).applyTaxChange();
      await cap.connect(user2).burn(ethers.parseEther("500"));
      await cap.connect(owner).proposeMint(user3.address, ethers.parseEther("10000"));
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).executeMint();
      await cap.connect(user1).delegate(user2.address);
      await cap.connect(owner).addPool(pool.address);
      await cap.connect(user3).transfer(pool.address, ethers.parseEther("1000"));

      // Verify invariants still hold
      const totalSupply = await cap.totalSupply();
      const maxSupply = await cap.MAX_SUPPLY();

      expect(totalSupply).to.be.lte(maxSupply);

      // Sum of balances should equal total supply
      const allAddresses = [owner.address, treasury.address, user1.address, user2.address, user3.address, pool.address];

      let sumBalances = 0n;
      for (const addr of allAddresses) {
        const balance = await cap.balanceOf(addr);
        expect(balance).to.be.gte(0);
        sumBalances += balance;
      }

      expect(sumBalances).to.equal(totalSupply);
    });
  });
});
