import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Edge Cases and Stress Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let pool1: HardhatEthersSigner;
  let pool2: HardhatEthersSigner;

  const _INITIAL_SUPPLY = ethers.parseEther("1000000000");

  beforeEach(async function () {
    [owner, treasury, user1, user2, pool1, pool2] = await ethers.getSigners();

    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;
  });

  describe("Extreme Value Testing", function () {
    it("Should handle maximum uint256 approval correctly", async function () {
      const maxUint256 = ethers.MaxUint256;

      await cap.connect(owner).approve(user1.address, maxUint256);
      expect(await cap.allowance(owner.address, user1.address)).to.equal(maxUint256);

      const spendAmount = ethers.parseEther("1000");
      await cap.connect(user1).transferFrom(owner.address, user2.address, spendAmount);

      const remaining = await cap.allowance(owner.address, user1.address);
      expect(remaining).to.equal(maxUint256);
    });

    it("Should handle transfers of exactly 1 wei", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

      const initialBalance = await cap.balanceOf(user1.address);
      await cap.connect(user1).transfer(user2.address, 1);

      expect(await cap.balanceOf(user2.address)).to.equal(1);
      expect(await cap.balanceOf(user1.address)).to.equal(initialBalance - 1n);
    });

    it("Should handle very small tax calculations", async function () {
      await cap.connect(owner).setTaxesImmediate(1, 1, 1);
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("1"));

      const transferAmount = 100;
      await cap.connect(user1).transfer(user2.address, transferAmount);

      expect(await cap.balanceOf(user2.address)).to.equal(100);
    });
  });

  describe("Complex Tax Scenarios", function () {
    it("Should handle rapid pool status changes during transfers", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));

      // Add pool
      await cap.connect(owner).addPool(pool1.address);

      // Transfer to pool (should apply sell tax)
      const treasuryBefore = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(pool1.address, ethers.parseEther("1000"));
      const treasuryAfter1 = await cap.balanceOf(treasury.address);

      // Remove pool status
      await cap.connect(owner).removePool(pool1.address);

      // Transfer to same address (now regular transfer)
      await cap.connect(user1).transfer(pool1.address, ethers.parseEther("1000"));
      const treasuryAfter2 = await cap.balanceOf(treasury.address);

      // Tax amounts should be different
      const sellTax = treasuryAfter1 - treasuryBefore;
      const transferTax = treasuryAfter2 - treasuryAfter1;

      expect(sellTax).to.be.gt(transferTax); // Sell tax (2%) > transfer tax (1%)
    });

    it("Should handle multiple pools with different tax scenarios", async function () {
      await cap.connect(owner).addPool(pool1.address);
      await cap.connect(owner).addPool(pool2.address);

      // Give tokens to pools and users
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
      await cap.connect(owner).transfer(pool1.address, ethers.parseEther("5000"));
      await cap.connect(owner).transfer(pool2.address, ethers.parseEther("5000"));

      const transferAmount = ethers.parseEther("1000");
      const treasuryInitial = await cap.balanceOf(treasury.address);

      // User to Pool1 (sell: transfer + sell tax = 2%)
      await cap.connect(user1).transfer(pool1.address, transferAmount);
      const afterSell = await cap.balanceOf(treasury.address);

      // Pool1 to Pool2 (no tax - pool to pool)
      await cap.connect(pool1).transfer(pool2.address, transferAmount);
      const afterPoolToPool = await cap.balanceOf(treasury.address);

      // Pool2 to User (buy: 0% tax)
      await cap.connect(pool2).transfer(user1.address, transferAmount);
      const afterBuy = await cap.balanceOf(treasury.address);

      // Verify tax patterns
      const sellTax = afterSell - treasuryInitial;
      const poolToPoolTax = afterPoolToPool - afterSell;
      const buyTax = afterBuy - afterPoolToPool;

      expect(sellTax).to.equal((transferAmount * 200n) / 10000n); // 2% sell tax
      expect(poolToPoolTax).to.equal(0); // No tax for pool-to-pool transfers
      expect(buyTax).to.equal(0); // No buy tax
    });

    it("Should handle tax changes during ongoing operations", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));

      // Initial taxes: 1% transfer, 1% sell, 0% buy
      const transferAmount = ethers.parseEther("1000");

      // First transfer with initial taxes
      const treasuryBefore = await cap.balanceOf(treasury.address);
      await cap.connect(user1).transfer(user2.address, transferAmount);
      const treasuryAfter1 = await cap.balanceOf(treasury.address);

      // Change taxes
      await cap.connect(owner).setTaxesImmediate(200, 300, 100); // 2%, 3%, 1%

      // Second transfer with new taxes
      await cap.connect(user1).transfer(user2.address, transferAmount);
      const treasuryAfter2 = await cap.balanceOf(treasury.address);

      // Verify different tax amounts
      const firstTax = treasuryAfter1 - treasuryBefore;
      const secondTax = treasuryAfter2 - treasuryAfter1;

      expect(firstTax).to.equal((transferAmount * 100n) / 10000n); // 1%
      expect(secondTax).to.equal((transferAmount * 200n) / 10000n); // 2%
    });
  });

  describe("Burn Mechanism Edge Cases", function () {
    it("Should handle burn mode with zero fee recipient correctly", async function () {
      await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

      const initialSupply = await cap.totalSupply();
      const transferAmount = ethers.parseEther("100");

      await cap.connect(user1).transfer(user2.address, transferAmount);

      const finalSupply = await cap.totalSupply();
      const taxAmount = (transferAmount * 100n) / 10000n;
      expect(finalSupply).to.equal(initialSupply - taxAmount);
    });

    it("Should handle burnFrom with allowances", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

      const burnAmount = ethers.parseEther("100");
      const user1BalanceAfterTransfer = await cap.balanceOf(user1.address);

      await cap.connect(user1).approve(user2.address, burnAmount);

      const initialSupply = await cap.totalSupply();

      await cap.connect(user2).burnFrom(user1.address, burnAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await cap.balanceOf(user1.address)).to.equal(user1BalanceAfterTransfer - burnAmount);
      expect(await cap.allowance(user1.address, user2.address)).to.equal(0);
    });
  });

  describe("Gas Efficiency", function () {
    it("Should handle gas-expensive operations within reasonable limits", async function () {
      // Add many pools to test gas efficiency
      const poolAddresses = [user1, user2, treasury, pool1, pool2];

      for (const pool of poolAddresses) {
        await cap.connect(owner).addPool(pool.address);
      }

      // Should still transfer efficiently
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

      const tx = await cap.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      const receipt = await tx.wait();

      // Gas usage should be reasonable (less than 200k for complex transfer)
      expect(receipt?.gasUsed).to.be.lt(200000);
    });
  });
});
