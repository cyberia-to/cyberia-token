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
		cap = await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
			kind: "uups",
			initializer: "initialize",
		}) as unknown as CAPToken;

		// Distribute some tokens for testing
		await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
		await cap.connect(owner).transfer(attacker.address, ethers.parseEther("1000"));
	});

	describe("Reentrancy Protection", function () {
		it("Should handle multiple rapid transfers without issues", async function () {
			const transferAmount = ethers.parseEther("100");

			// Rapid successive transfers (simulating potential reentrancy)
			const promises = [];
			for (let i = 0; i < 5; i++) {
				promises.push(cap.connect(user1).transfer(user2.address, transferAmount));
			}

			// All should complete successfully
			await Promise.all(promises);

			// Verify final balances are correct
			const user1Balance = await cap.balanceOf(user1.address);
			const user2Balance = await cap.balanceOf(user2.address);
			const treasuryBalance = await cap.balanceOf(treasury.address);

			expect(user2Balance).to.be.gt(0);
			expect(treasuryBalance).to.be.gt(0);
		});
	});

	describe("Access Control", function () {
		it("Should prevent attackers from calling admin functions", async function () {
			await expect(cap.connect(attacker).setTaxes(0, 0, 0))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");

			await expect(cap.connect(attacker).setFeeRecipient(attacker.address))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");

			await expect(cap.connect(attacker).addPool(pool.address))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");

			await expect(cap.connect(attacker).removePool(pool.address))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});

		it("Should prevent unauthorized upgrades", async function () {
			const CAPv2 = await ethers.getContractFactory("CAPToken");
			const newImplementation = await CAPv2.deploy();

			await expect(cap.connect(attacker).upgradeToAndCall(await newImplementation.getAddress(), "0x"))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});

		it("Should prevent ownership transfer by non-owner", async function () {
			await expect(cap.connect(attacker).transferOwnership(attacker.address))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});
	});

	describe("Tax Manipulation Resistance", function () {
		it("Should enforce maximum tax limits even with max values", async function () {
			// Attempt to set taxes above maximum
			await expect(cap.connect(owner).setTaxes(10000, 100, 100))
				.to.be.revertedWith("TRANSFER_TAX_TOO_HIGH");

			await expect(cap.connect(owner).setTaxes(100, 10000, 100))
				.to.be.revertedWith("SELL_TAX_TOO_HIGH");

			await expect(cap.connect(owner).setTaxes(100, 100, 10000))
				.to.be.revertedWith("BUY_TAX_TOO_HIGH");

			// Verify maximum allowed values work
			await expect(cap.connect(owner).setTaxes(500, 500, 500))
				.to.not.be.reverted;
		});

		it("Should handle edge case tax calculations correctly", async function () {
			// Set taxes to edge values
			await cap.connect(owner).setTaxes(1, 1, 1); // 0.01% each

			const transferAmount = ethers.parseEther("0.1"); // Small amount
			const initialBalance = await cap.balanceOf(user1.address);

			await cap.connect(user1).transfer(user2.address, transferAmount);

			// Should handle micro-tax amounts correctly
			const finalBalance = await cap.balanceOf(user1.address);
			expect(finalBalance).to.be.lt(initialBalance);
		});
	});

	describe("Supply Manipulation Protection", function () {
		it("Should maintain consistent total supply through all operations", async function () {
			const initialSupply = await cap.totalSupply();

			// Various operations that could affect supply
			await cap.connect(user1).transfer(user2.address, ethers.parseEther("100"));
			await cap.connect(owner).addPool(pool.address);
			await cap.connect(user1).transfer(pool.address, ethers.parseEther("50"));
			await cap.connect(user1).burn(ethers.parseEther("10"));

			const currentSupply = await cap.totalSupply();

			// Supply should only decrease by burned amount
			expect(currentSupply).to.equal(initialSupply - ethers.parseEther("10"));
		});

		it("Should prevent minting after deployment", async function () {
			// No public mint function should exist
			const cap_contract = cap as any;
			expect(cap_contract.mint).to.be.undefined;

			// _mint should not be accessible
			expect(cap_contract._mint).to.be.undefined;
		});
	});

	describe("Pool Manipulation Protection", function () {
		it("Should prevent duplicate pool additions", async function () {
			await cap.connect(owner).addPool(pool.address);

			await expect(cap.connect(owner).addPool(pool.address))
				.to.be.revertedWith("EXISTS");
		});

		it("Should prevent removing non-existent pools", async function () {
			await expect(cap.connect(owner).removePool(pool.address))
				.to.be.revertedWith("NOT_POOL");
		});

		it("Should handle pool status changes correctly", async function () {
			// Add pool
			await cap.connect(owner).addPool(pool.address);
			expect(await cap.isPool(pool.address)).to.be.true;

			// Remove pool
			await cap.connect(owner).removePool(pool.address);
			expect(await cap.isPool(pool.address)).to.be.false;

			// Can re-add after removal
			await cap.connect(owner).addPool(pool.address);
			expect(await cap.isPool(pool.address)).to.be.true;
		});
	});

	describe("Governance Attack Resistance", function () {
		it("Should handle ownership transfer correctly", async function () {
			const newOwner = user2.address;

			// Transfer ownership
			await cap.connect(owner).transferOwnership(newOwner);
			expect(await cap.owner()).to.equal(newOwner);

			// Old owner should lose access
			await expect(cap.connect(owner).setTaxes(200, 200, 0))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");

			// New owner should have access
			await expect(cap.connect(user2).setTaxes(200, 200, 0))
				.to.not.be.reverted;
		});

		it("Should handle malicious fee recipient changes", async function () {
			// Set fee recipient to attacker
			await cap.connect(owner).setFeeRecipient(attacker.address);

			const transferAmount = ethers.parseEther("100");
			const attackerInitialBalance = await cap.balanceOf(attacker.address);

			await cap.connect(user1).transfer(user2.address, transferAmount);

			// Attacker should receive tax fees
			const attackerFinalBalance = await cap.balanceOf(attacker.address);
			expect(attackerFinalBalance).to.be.gt(attackerInitialBalance);

			// Should be able to change back to treasury
			await cap.connect(owner).setFeeRecipient(treasury.address);
		});
	});

	describe("Edge Cases and Error Conditions", function () {
		it("Should handle zero amount transfers", async function () {
			await expect(cap.connect(user1).transfer(user2.address, 0))
				.to.not.be.reverted;
		});

		it("Should handle transfers with insufficient balance", async function () {
			const userBalance = await cap.balanceOf(user1.address);
			const excessiveAmount = userBalance + 1n;

			await expect(cap.connect(user1).transfer(user2.address, excessiveAmount))
				.to.be.revertedWithCustomError(cap, "ERC20InsufficientBalance");
		});

		it("Should handle burning more than balance", async function () {
			const userBalance = await cap.balanceOf(user1.address);
			const excessiveAmount = userBalance + 1n;

			await expect(cap.connect(user1).burn(excessiveAmount))
				.to.be.revertedWithCustomError(cap, "ERC20InsufficientBalance");
		});

		it("Should handle delegation edge cases", async function () {
			// Self-delegation
			await cap.connect(user1).delegate(user1.address);
			const votingPower = await cap.getVotes(user1.address);
			expect(votingPower).to.equal(await cap.balanceOf(user1.address));

			// Delegate to zero address (should not revert)
			await expect(cap.connect(user1).delegate(ethers.ZeroAddress))
				.to.not.be.reverted;
		});
	});

	describe("Gas Optimization and DoS Resistance", function () {
		it("Should handle large batch operations efficiently", async function () {
			// Add multiple pools
			const pools = [user1, user2, treasury, attacker];

			for (const pool of pools) {
				await cap.connect(owner).addPool(pool.address);
			}

			// Should still function normally
			await cap.connect(user1).transfer(user2.address, ethers.parseEther("10"));
		});

		it("Should handle maximum tax calculations without overflow", async function () {
			// Set maximum allowed taxes
			await cap.connect(owner).setTaxes(500, 500, 500);

			// Transfer maximum possible amount (within user balance)
			const userBalance = await cap.balanceOf(user1.address);
			await cap.connect(user1).transfer(user2.address, userBalance);

			// Should complete without overflow
			expect(await cap.balanceOf(user1.address)).to.equal(0);
		});
	});
});