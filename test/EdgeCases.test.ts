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

	const INITIAL_SUPPLY = ethers.parseEther("1000000000");

	beforeEach(async function () {
		[owner, treasury, user1, user2, pool1, pool2] = await ethers.getSigners();

		const CAP = await ethers.getContractFactory("CAPToken");
		cap = await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
			kind: "uups",
			initializer: "initialize",
		}) as unknown as CAPToken;
	});

	describe("Extreme Value Testing", function () {
		it("Should handle maximum uint256 approval correctly", async function () {
			const maxUint256 = ethers.MaxUint256;

			await cap.connect(owner).approve(user1.address, maxUint256);
			expect(await cap.allowance(owner.address, user1.address)).to.equal(maxUint256);

			// Should be able to spend some without overflow
			const spendAmount = ethers.parseEther("1000");
			await cap.connect(user1).transferFrom(owner.address, user2.address, spendAmount);

			// Allowance should still be max (special case in OpenZeppelin)
			const remaining = await cap.allowance(owner.address, user1.address);
			expect(remaining).to.equal(maxUint256);
		});

		it("Should handle transfers of exactly 1 wei", async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

			const initialBalance = await cap.balanceOf(user1.address);

			// Transfer 1 wei
			await cap.connect(user1).transfer(user2.address, 1);

			// With 1% tax, 1 wei transfer should work (tax rounds down to 0)
			expect(await cap.balanceOf(user2.address)).to.equal(1);
			expect(await cap.balanceOf(user1.address)).to.equal(initialBalance - 1n);
		});

		it("Should handle very small tax calculations", async function () {
			// Set minimal tax rates
			await cap.connect(owner).setTaxes(1, 1, 1); // 0.01% each

			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1"));

			const transferAmount = 100; // 100 wei
			await cap.connect(user1).transfer(user2.address, transferAmount);

			// Tax should be 0 due to rounding down
			expect(await cap.balanceOf(user2.address)).to.equal(100);
		});

		it("Should handle maximum supply calculations", async function () {
			// Verify initial supply is correct
			expect(await cap.totalSupply()).to.equal(INITIAL_SUPPLY);

			// Verify max supply constant (type(uint224).max)
			const maxSupply = BigInt("26959946667150639794667015087019630673637144422540572481103610249215");
			expect(INITIAL_SUPPLY).to.be.lt(maxSupply);

			// Verify no overflow in calculations
			const ownerBalance = await cap.balanceOf(owner.address);
			expect(ownerBalance).to.be.lte(INITIAL_SUPPLY);
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

			expect(sellTax).to.equal(transferAmount * 200n / 10000n); // 2% sell tax
			expect(poolToPoolTax).to.equal(transferAmount * 100n / 10000n); // 1% transfer tax (pool to pool)
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
			await cap.connect(owner).setTaxes(200, 300, 100); // 2%, 3%, 1%

			// Second transfer with new taxes
			await cap.connect(user1).transfer(user2.address, transferAmount);
			const treasuryAfter2 = await cap.balanceOf(treasury.address);

			// Verify different tax amounts
			const firstTax = treasuryAfter1 - treasuryBefore;
			const secondTax = treasuryAfter2 - treasuryAfter1;

			expect(firstTax).to.equal(transferAmount * 100n / 10000n); // 1%
			expect(secondTax).to.equal(transferAmount * 200n / 10000n); // 2%
		});
	});

	describe("Burn Mechanism Edge Cases", function () {
		it("Should handle burn mode with zero fee recipient correctly", async function () {
			await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

			const initialSupply = await cap.totalSupply();
			const transferAmount = ethers.parseEther("100");

			await cap.connect(user1).transfer(user2.address, transferAmount);

			// Supply should decrease by tax amount
			const finalSupply = await cap.totalSupply();
			const taxAmount = transferAmount * 100n / 10000n; // 1%
			expect(finalSupply).to.equal(initialSupply - taxAmount);
		});

		it("Should handle manual burning correctly", async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

			const initialSupply = await cap.totalSupply();
			const user1BalanceAfterTransfer = await cap.balanceOf(user1.address);
			const burnAmount = ethers.parseEther("100");

			await cap.connect(user1).burn(burnAmount);

			expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
			expect(await cap.balanceOf(user1.address)).to.equal(user1BalanceAfterTransfer - burnAmount);
		});

		it("Should handle burnFrom with allowances", async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));

			const burnAmount = ethers.parseEther("100");
			const user1BalanceAfterTransfer = await cap.balanceOf(user1.address);

			// Approve user2 to burn user1's tokens
			await cap.connect(user1).approve(user2.address, burnAmount);

			const initialSupply = await cap.totalSupply();

			await cap.connect(user2).burnFrom(user1.address, burnAmount);

			expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
			expect(await cap.balanceOf(user1.address)).to.equal(user1BalanceAfterTransfer - burnAmount);
			expect(await cap.allowance(user1.address, user2.address)).to.equal(0);
		});
	});

	describe("Governance and Voting Edge Cases", function () {
		it("Should handle voting power with tax operations", async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
			await cap.connect(user1).delegate(user1.address);

			const initialVotingPower = await cap.getVotes(user1.address);

			// Transfer some tokens (reduces balance and voting power)
			const transferAmount = ethers.parseEther("1000");
			await cap.connect(user1).transfer(user2.address, transferAmount);

			const finalVotingPower = await cap.getVotes(user1.address);
			const finalBalance = await cap.balanceOf(user1.address);

			// Voting power should equal current balance
			expect(finalVotingPower).to.equal(finalBalance);
			expect(finalVotingPower).to.be.lt(initialVotingPower);
		});

		it("Should handle delegation chains correctly", async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("5000"));
			await cap.connect(owner).transfer(user2.address, ethers.parseEther("3000"));

			// user1 delegates to user2
			await cap.connect(user1).delegate(user2.address);
			await cap.connect(user2).delegate(user2.address);

			const user1Balance = await cap.balanceOf(user1.address);
			const user2Balance = await cap.balanceOf(user2.address);
			const user2VotingPower = await cap.getVotes(user2.address);

			// user2 should have voting power from both accounts
			expect(user2VotingPower).to.equal(user1Balance + user2Balance);
		});
	});

	describe("Permit and Meta-Transaction Support", function () {
		it("Should support permit domain separator", async function () {
			const domain = await cap.DOMAIN_SEPARATOR();
			expect(domain).to.not.equal(ethers.ZeroHash);
		});

		it("Should handle nonce correctly", async function () {
			const initialNonce = await cap.nonces(user1.address);
			expect(initialNonce).to.equal(0);

			// Nonces are only used for permit signatures, not delegation
			// Delegation doesn't increment nonce in OpenZeppelin implementation
			await cap.connect(user1).delegate(user1.address);
			const afterDelegateNonce = await cap.nonces(user1.address);
			expect(afterDelegateNonce).to.equal(0); // Nonce unchanged
		});
	});

	describe("Upgrade Safety", function () {
		it("Should maintain state after upgrade simulation", async function () {
			// Setup state
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
			await cap.connect(owner).addPool(pool1.address);
			await cap.connect(owner).setTaxes(200, 300, 100);

			// Record current state
			const balance = await cap.balanceOf(user1.address);
			const isPool = await cap.isPool(pool1.address);
			const transferTax = await cap.transferTaxBp();
			const owner_addr = await cap.owner();

			// Deploy new implementation
			const CAPv2 = await ethers.getContractFactory("CAPToken");
			const newImpl = await CAPv2.deploy();

			// Simulate upgrade (in real scenario this would be done through governance)
			await cap.connect(owner).upgradeToAndCall(await newImpl.getAddress(), "0x");

			// Verify state preservation
			expect(await cap.balanceOf(user1.address)).to.equal(balance);
			expect(await cap.isPool(pool1.address)).to.equal(isPool);
			expect(await cap.transferTaxBp()).to.equal(transferTax);
			expect(await cap.owner()).to.equal(owner_addr);
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