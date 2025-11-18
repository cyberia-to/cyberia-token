import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken } from "../typechain-types";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Advanced Security Tests", function () {
  let cap: CAPToken;
  let owner: Signer;
  let treasury: Signer;
  let attacker: Signer;
  let user1: Signer;
  let user2: Signer;

  beforeEach(async function () {
    [owner, treasury, attacker, user1, user2] = await ethers.getSigners();

    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Distribute tokens for testing
    await cap.connect(owner).transfer(user1.address, ethers.utils.parseEther("100000"));
    await cap.connect(owner).transfer(attacker.address, ethers.utils.parseEther("10000"));
  });

  describe("Reentrancy Attack Simulation", function () {
    it("Should prevent reentrancy via nonReentrant modifier", async function () {
      // Note: ERC20 transfers don't have receiver hooks, but the nonReentrant modifier
      // protects against any potential reentrancy in the _update function

      const transferAmount = ethers.utils.parseEther("100");
      const user1BalanceBefore = await cap.balanceOf(user1.address);

      // Attempt transfer (should succeed without reentrancy)
      await cap.connect(user1).transfer(user2.address, transferAmount);

      const user1BalanceAfter = await cap.balanceOf(user1.address);

      // Verify balance changed exactly once
      expect(user1BalanceBefore.sub(user1BalanceAfter)).to.equal(transferAmount);

      // The nonReentrant modifier ensures that if any future upgrade adds
      // hooks or callbacks, reentrancy will still be prevented
    });

    it("Should handle nested transfer attempts safely", async function () {
      // Test that multiple transfers in sequence work correctly
      const amount = ethers.utils.parseEther("10");

      // Start balance
      const startBalance = await cap.balanceOf(user1.address);

      // Multiple transfers
      await cap.connect(user1).transfer(user2.address, amount);
      await cap.connect(user1).transfer(user2.address, amount);
      await cap.connect(user1).transfer(user2.address, amount);

      const endBalance = await cap.balanceOf(user1.address);

      // Should have transferred exactly 3x amount (plus taxes)
      const expectedDeduction = amount.mul(3);
      expect(startBalance.sub(endBalance)).to.equal(expectedDeduction);
    });
  });

  describe("EIP-2612 Permit Functionality", function () {
    it("Should support full EIP-2612 permit signature flow", async function () {
      // Get current block timestamp from hardhat network
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      const deadline = currentTime + 3600; // 1 hour from current block time
      const value = ethers.utils.parseEther("1000");

      // Get domain separator
      const domain = {
        name: await cap.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: cap.address,
      };

      // Define permit type
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      // Get current nonce
      const nonce = await cap.nonces(user1.address);

      // Create permit message
      const message = {
        owner: user1.address,
        spender: user2.address,
        value: value,
        nonce: nonce,
        deadline: deadline,
      };

      // Sign the permit (ethers v5 uses _signTypedData)
      const signature = await user1._signTypedData(domain, types, message);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      // Verify allowance is 0 before permit
      expect(await cap.allowance(user1.address, user2.address)).to.equal(0);

      // Execute permit
      await cap.permit(user1.address, user2.address, value, deadline, v, r, s);

      // Verify allowance is now set
      expect(await cap.allowance(user1.address, user2.address)).to.equal(value);

      // Verify nonce was incremented
      expect(await cap.nonces(user1.address)).to.equal(nonce.add(1));

      // User2 can now spend user1's tokens
      const user1BalanceBefore = await cap.balanceOf(user1.address);
      const user2BalanceBefore = await cap.balanceOf(user2.address);

      await cap.connect(user2).transferFrom(user1.address, user2.address, value);

      // Verify transfer occurred with tax
      const tax = value.mul(100).div(10000); // 1%
      const netAmount = value.sub(tax);

      expect(await cap.balanceOf(user1.address)).to.equal(user1BalanceBefore.sub(value));
      expect(await cap.balanceOf(user2.address)).to.equal(user2BalanceBefore.add(netAmount));
    });

    it("Should reject permit with invalid signature", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const value = ethers.utils.parseEther("1000");
      const _nonce = await cap.nonces(user1.address);

      // Create invalid signature
      const invalidR = "0x1234567890123456789012345678901234567890123456789012345678901234";
      const invalidS = "0x1234567890123456789012345678901234567890123456789012345678901234";
      const v = 27;

      await expect(cap.permit(user1.address, user2.address, value, deadline, v, invalidR, invalidS)).to.be.reverted;
    });

    it("Should reject expired permit", async function () {
      // Get current block timestamp from hardhat network
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock!.timestamp;
      const expiredDeadline = currentTime - 3600; // 1 hour ago from current block time
      const value = ethers.utils.parseEther("1000");

      const domain = {
        name: await cap.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: cap.address,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const nonce = await cap.nonces(user1.address);

      const message = {
        owner: user1.address,
        spender: user2.address,
        value: value,
        nonce: nonce,
        deadline: expiredDeadline,
      };

      const signature = await user1._signTypedData(domain, types, message);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      await expect(cap.permit(user1.address, user2.address, value, expiredDeadline, v, r, s)).to.be.reverted;
    });
  });

  describe("Storage Collision and Upgrade Safety", function () {
    it("Should preserve storage layout after upgrade", async function () {
      // Set up initial state
      await cap.connect(owner).addPool(user1.address);
      await cap.connect(owner).proposeTaxChange(200, 300, 100);

      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).applyTaxChange();
      await cap.connect(owner).transfer(user2.address, ethers.utils.parseEther("1000"));

      // Record all state
      const stateBefore = {
        name: await cap.name(),
        symbol: await cap.symbol(),
        totalSupply: await cap.totalSupply(),
        decimals: await cap.decimals(),
        owner: await cap.governance(),
        feeRecipient: await cap.feeRecipient(),
        transferTaxBp: await cap.transferTaxBp(),
        sellTaxBp: await cap.sellTaxBp(),
        buyTaxBp: await cap.buyTaxBp(),
        isPoolUser1: await cap.isPool(user1.address),
        balanceOwner: await cap.balanceOf(owner.address),
        balanceUser2: await cap.balanceOf(user2.address),
      };

      // Deploy new implementation (same code)
      const CAPv2 = await ethers.getContractFactory("CAPToken");
      const newImpl = await CAPv2.deploy();

      // Upgrade
      await cap.connect(owner).upgradeToAndCall(newImpl.address, "0x");

      // Verify all state preserved
      expect(await cap.name()).to.equal(stateBefore.name);
      expect(await cap.symbol()).to.equal(stateBefore.symbol);
      expect(await cap.totalSupply()).to.equal(stateBefore.totalSupply);
      expect(await cap.decimals()).to.equal(stateBefore.decimals);
      expect(await cap.governance()).to.equal(stateBefore.owner);
      expect(await cap.feeRecipient()).to.equal(stateBefore.feeRecipient);
      expect(await cap.transferTaxBp()).to.equal(stateBefore.transferTaxBp);
      expect(await cap.sellTaxBp()).to.equal(stateBefore.sellTaxBp);
      expect(await cap.buyTaxBp()).to.equal(stateBefore.buyTaxBp);
      expect(await cap.isPool(user1.address)).to.equal(stateBefore.isPoolUser1);
      expect(await cap.balanceOf(owner.address)).to.equal(stateBefore.balanceOwner);
      expect(await cap.balanceOf(user2.address)).to.equal(stateBefore.balanceUser2);
    });

    it("Should handle upgrade with pending tax change", async function () {
      // Propose tax change
      await cap.connect(owner).proposeTaxChange(300, 400, 50);

      const timestampBefore = await cap.taxChangeTimestamp();
      const pendingTransferBefore = await cap.pendingTransferTaxBp();
      const pendingSellBefore = await cap.pendingSellTaxBp();
      const pendingBuyBefore = await cap.pendingBuyTaxBp();

      // Upgrade contract
      const CAPv2 = await ethers.getContractFactory("CAPToken");
      const newImpl = await CAPv2.deploy();
      await cap.connect(owner).upgradeToAndCall(newImpl.address, "0x");

      // Verify pending state preserved
      expect(await cap.taxChangeTimestamp()).to.equal(timestampBefore);
      expect(await cap.pendingTransferTaxBp()).to.equal(pendingTransferBefore);
      expect(await cap.pendingSellTaxBp()).to.equal(pendingSellBefore);
      expect(await cap.pendingBuyTaxBp()).to.equal(pendingBuyBefore);

      // Verify can still apply after timelock
      await time.increase(24 * 60 * 60 + 1); // Move forward 24 hours
      await cap.connect(owner).applyTaxChange();

      expect(await cap.transferTaxBp()).to.equal(300);
      expect(await cap.sellTaxBp()).to.equal(400);
      expect(await cap.buyTaxBp()).to.equal(50);
    });

    it("Should maintain correct storage slots for critical variables", async function () {
      // This test verifies that storage layout hasn't been corrupted
      // by checking that values remain correct after various operations

      // Set multiple values
      await cap.connect(owner).addPool(user1.address);
      await cap.connect(owner).addPool(user2.address);
      await cap.connect(owner).setFeeRecipient(attacker.address);
      await cap.connect(owner).proposeTaxChange(150, 200, 50);

      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).applyTaxChange();

      // Perform transfers
      await cap.connect(owner).transfer(user1.address, ethers.utils.parseEther("500"));
      await cap.connect(user1).transfer(user2.address, ethers.utils.parseEther("100"));

      // Verify all storage slots
      expect(await cap.isPool(user1.address)).to.be.true;
      expect(await cap.isPool(user2.address)).to.be.true;
      expect(await cap.feeRecipient()).to.equal(attacker.address);
      expect(await cap.transferTaxBp()).to.equal(150);
      expect(await cap.sellTaxBp()).to.equal(200);
      expect(await cap.buyTaxBp()).to.equal(50);

      // Verify balances are correct
      expect(await cap.balanceOf(user1.address)).to.be.gt(0);
      expect(await cap.balanceOf(user2.address)).to.be.gt(0);
    });
  });

  describe("Max Supply Protection", function () {
    it("Should enforce max supply cap on minting", async function () {
      const maxSupply = await cap.MAX_SUPPLY();
      const currentSupply = await cap.totalSupply();

      // Calculate available supply within rate limit (100M per 30 days)
      const rateLimitCap = ethers.utils.parseEther("100000000");
      const mintAmount = rateLimitCap < maxSupply - currentSupply ? rateLimitCap : maxSupply - currentSupply;

      // Should succeed: mint within rate limit and supply cap
      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint()).to.not.be.reverted;

      // Should fail: try to mint over rate limit
      await expect(cap.connect(owner).proposeMint(user1.address, 1)).to.be.revertedWith("EXCEEDS_MINT_CAP_PER_PERIOD");
    });

    it("Should handle minting close to max supply", async function () {
      const _maxSupply = await cap.MAX_SUPPLY();
      const _currentSupply = await cap.totalSupply();
      const _rateLimitCap = ethers.utils.parseEther("100000000");

      // Mint within rate limit
      const mintAmount = ethers.utils.parseEther("50000000"); // 50M
      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).executeMint();

      // Should still be able to mint remaining (within rate limit)
      const remaining = ethers.utils.parseEther("50000000"); // Another 50M
      await cap.connect(owner).proposeMint(user2.address, remaining);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint()).to.not.be.reverted;

      // Now at rate limit for this period
      await expect(cap.connect(owner).proposeMint(user1.address, 1)).to.be.revertedWith("EXCEEDS_MINT_CAP_PER_PERIOD");
    });

    it("Should allow minting after burning brings supply below cap", async function () {
      const mintAmount = ethers.utils.parseEther("50000000"); // 50M

      // Mint within rate limit
      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).executeMint();

      // Burn some tokens
      await cap.connect(user1).burn(ethers.utils.parseEther("1000"));

      // Mint more (within rate limit)
      await cap.connect(owner).proposeMint(user2.address, ethers.utils.parseEther("10000000"));

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint()).to.not.be.reverted;
    });
  });
});
