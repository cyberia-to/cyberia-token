import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Security Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let pool: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, treasury, attacker, user1, user2, pool] = await ethers.getSigners();

    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Distribute some tokens for testing
    await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
    await cap.connect(owner).transfer(attacker.address, ethers.parseEther("1000"));
  });

  describe("Access Control", function () {
    it("Should prevent attackers from calling admin functions", async function () {
      // Tax changes require governance
      await expect(cap.connect(attacker).proposeTaxChange(0, 0, 0)).to.be.revertedWith("ONLY_GOVERNANCE");

      // Fee recipient changes require governance
      await expect(cap.connect(attacker).setFeeRecipient(attacker.address)).to.be.revertedWith("ONLY_GOVERNANCE");

      // Pool management requires governance
      await expect(cap.connect(attacker).addPool(pool.address)).to.be.revertedWith("ONLY_GOVERNANCE");

      await expect(cap.connect(attacker).removePool(pool.address)).to.be.revertedWith("ONLY_GOVERNANCE");
    });

    it("Should prevent unauthorized upgrades", async function () {
      const CAPv2 = await ethers.getContractFactory("CAPToken");
      const newImplementation = await CAPv2.deploy();

      // Upgrades require UPGRADER_ROLE
      await expect(
        cap.connect(attacker).upgradeToAndCall(await newImplementation.getAddress(), "0x")
      ).to.be.revertedWith("ONLY_GOVERNANCE");
    });

    it("Should prevent governance transfer by non-governance", async function () {
      // Governance transfer is protected by onlyGovernance modifier
      await expect(cap.connect(attacker).setGovernance(attacker.address)).to.be.revertedWith("ONLY_GOVERNANCE");
    });
  });

  describe("Tax Manipulation Resistance", function () {
    it("Should enforce maximum tax limits even with max values", async function () {
      await expect(cap.connect(owner).proposeTaxChange(10000, 100, 100)).to.be.revertedWith("TRANSFER_TAX_TOO_HIGH");

      await expect(cap.connect(owner).proposeTaxChange(100, 10000, 100)).to.be.revertedWith("SELL_TAX_TOO_HIGH");

      await expect(cap.connect(owner).proposeTaxChange(100, 100, 10000)).to.be.revertedWith("BUY_TAX_TOO_HIGH");

      await expect(cap.connect(owner).proposeTaxChange(400, 400, 500)).to.not.be.reverted;

      await expect(cap.connect(owner).proposeTaxChange(450, 400, 0)).to.be.revertedWith("COMBINED_SELL_TAX_TOO_HIGH");
    });
  });

  describe("Supply Manipulation Protection", function () {
    it("Should maintain consistent total supply through all operations", async function () {
      const initialSupply = await cap.totalSupply();

      await cap.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      await cap.connect(owner).addPool(pool.address);
      await cap.connect(user1).transfer(pool.address, ethers.parseEther("50"));
      await cap.connect(user1).burn(ethers.parseEther("10"));

      const currentSupply = await cap.totalSupply();
      expect(currentSupply).to.equal(initialSupply - ethers.parseEther("10"));
    });

    it("Should restrict minting to authorized roles only", async function () {
      const mintAmount = ethers.parseEther("1000000");

      // Attacker without governance cannot propose mint
      await expect(cap.connect(attacker).proposeMint(attacker.address, mintAmount)).to.be.revertedWith(
        "ONLY_GOVERNANCE"
      );

      const initialSupply = await cap.totalSupply();

      // Owner can propose and execute mint after timelock
      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint()).to.not.be.reverted;

      expect(await cap.totalSupply()).to.equal(initialSupply + mintAmount);
    });
  });

  describe("Governance Attack Resistance", function () {
    it("Should handle governance transfer correctly", async function () {
      const newGovernance = user2.address;

      // Transfer governance to user2
      await cap.connect(owner).setGovernance(newGovernance);
      expect(await cap.governance()).to.equal(newGovernance);

      // Now old owner loses admin access
      await expect(cap.connect(owner).proposeTaxChange(200, 200, 0)).to.be.revertedWith("ONLY_GOVERNANCE");

      // New governance has admin access and can propose tax changes
      await expect(cap.connect(user2).proposeTaxChange(200, 200, 0)).to.not.be.reverted;
    });
  });

  describe("Edge Cases and Error Conditions", function () {
    it("Should handle zero amount transfers", async function () {
      await expect(cap.connect(user1).transfer(user2.address, 0)).to.not.be.reverted;
    });

    it("Should handle transfers with insufficient balance", async function () {
      const userBalance = await cap.balanceOf(user1.address);
      const excessiveAmount = userBalance + 1n;

      await expect(cap.connect(user1).transfer(user2.address, excessiveAmount)).to.be.revertedWithCustomError(
        cap,
        "ERC20InsufficientBalance"
      );
    });

    it("Should handle burning more than balance", async function () {
      const userBalance = await cap.balanceOf(user1.address);
      const excessiveAmount = userBalance + 1n;

      await expect(cap.connect(user1).burn(excessiveAmount)).to.be.revertedWithCustomError(
        cap,
        "ERC20InsufficientBalance"
      );
    });
  });

  describe("Gas Optimization and DoS Resistance", function () {
    it("Should handle maximum tax calculations without overflow", async function () {
      await cap.connect(owner).proposeTaxChange(400, 400, 500);

      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).applyTaxChange();

      const userBalance = await cap.balanceOf(user1.address);
      await cap.connect(user1).transfer(user2.address, userBalance);

      expect(await cap.balanceOf(user1.address)).to.equal(0);
    });
  });
});
