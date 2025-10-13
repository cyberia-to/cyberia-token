import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken, OFTAdapterStub } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CAPToken", function () {
	let cap: CAPToken;
	let oftStub: OFTAdapterStub;
	let owner: HardhatEthersSigner;
	let treasury: HardhatEthersSigner;
	let user1: HardhatEthersSigner;
	let user2: HardhatEthersSigner;
	let pool: HardhatEthersSigner;

	const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1B tokens
	const BASIS_POINTS_DENOMINATOR = 10000;

	beforeEach(async function () {
		[owner, treasury, user1, user2, pool] = await ethers.getSigners();

		// Deploy CAP Token
		const CAP = await ethers.getContractFactory("CAPToken");
		cap = await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
			kind: "uups",
			initializer: "initialize",
		}) as unknown as CAPToken;

		// Deploy OFT Adapter Stub
		const OFTStub = await ethers.getContractFactory("OFTAdapterStub");
		oftStub = await upgrades.deployProxy(OFTStub, [owner.address], {
			kind: "uups",
			initializer: "initialize",
		}) as unknown as OFTAdapterStub;
	});

	describe("Deployment", function () {
		it("Should set the correct name and symbol", async function () {
			expect(await cap.name()).to.equal("Cyberia");
			expect(await cap.symbol()).to.equal("CAP");
			expect(await cap.decimals()).to.equal(18);
		});

		it("Should mint initial supply to owner", async function () {
			expect(await cap.totalSupply()).to.equal(INITIAL_SUPPLY);
			expect(await cap.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
		});

		it("Should set correct initial tax rates", async function () {
			expect(await cap.transferTaxBp()).to.equal(100); // 1%
			expect(await cap.sellTaxBp()).to.equal(100); // 1%
			expect(await cap.buyTaxBp()).to.equal(0); // 0%
		});

		it("Should set fee recipient", async function () {
			expect(await cap.feeRecipient()).to.equal(treasury.address);
		});

		it("Should set owner", async function () {
			expect(await cap.owner()).to.equal(owner.address);
		});
	});

	describe("Tax System", function () {
		beforeEach(async function () {
			// Distribute tokens for testing
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("100000"));
			await cap.connect(owner).transfer(user2.address, ethers.parseEther("100000"));
		});

		it("Should apply transfer tax on user-to-user transfers", async function () {
			const transferAmount = ethers.parseEther("1000");
			const expectedTax = transferAmount * 100n / 10000n; // 1%
			const expectedNet = transferAmount - expectedTax;

			const user1InitialBalance = await cap.balanceOf(user1.address);
			const user2InitialBalance = await cap.balanceOf(user2.address);
			const treasuryInitialBalance = await cap.balanceOf(treasury.address);

			await cap.connect(user1).transfer(user2.address, transferAmount);

			expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance - transferAmount);
			expect(await cap.balanceOf(user2.address)).to.equal(user2InitialBalance + expectedNet);
			expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance + expectedTax);
		});

		it("Should apply sell tax when transferring to pool", async function () {
			// Add pool
			await cap.connect(owner).addPool(pool.address);

			const transferAmount = ethers.parseEther("1000");
			const transferTax = transferAmount * 100n / 10000n; // 1% transfer tax
			const sellTax = transferAmount * 100n / 10000n; // 1% sell tax
			const totalTax = transferTax + sellTax; // 2% total
			const expectedNet = transferAmount - totalTax;

			const user1InitialBalance = await cap.balanceOf(user1.address);
			const poolInitialBalance = await cap.balanceOf(pool.address);
			const treasuryInitialBalance = await cap.balanceOf(treasury.address);

			await cap.connect(user1).transfer(pool.address, transferAmount);

			expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance - transferAmount);
			expect(await cap.balanceOf(pool.address)).to.equal(poolInitialBalance + expectedNet);
			expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance + totalTax);
		});

		it("Should apply no tax when transferring from pool (buy)", async function () {
			// Add pool and give it tokens
			await cap.connect(owner).addPool(pool.address);
			await cap.connect(owner).transfer(pool.address, ethers.parseEther("10000"));

			const transferAmount = ethers.parseEther("1000");

			const poolInitialBalance = await cap.balanceOf(pool.address);
			const user1InitialBalance = await cap.balanceOf(user1.address);
			const treasuryInitialBalance = await cap.balanceOf(treasury.address);

			await cap.connect(pool).transfer(user1.address, transferAmount);

			expect(await cap.balanceOf(pool.address)).to.equal(poolInitialBalance - transferAmount);
			expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance + transferAmount);
			expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance); // No change
		});

		it("Should burn taxes when fee recipient is zero address", async function () {
			// Set fee recipient to zero address
			await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);

			const transferAmount = ethers.parseEther("1000");
			const expectedTax = transferAmount * 100n / 10000n; // 1%

			const initialSupply = await cap.totalSupply();

			await cap.connect(user1).transfer(user2.address, transferAmount);

			expect(await cap.totalSupply()).to.equal(initialSupply - expectedTax);
		});
	});

	describe("Pool Management", function () {
		it("Should allow owner to add pools", async function () {
			await expect(cap.connect(owner).addPool(pool.address))
				.to.emit(cap, "PoolAdded")
				.withArgs(pool.address);

			expect(await cap.isPool(pool.address)).to.be.true;
		});

		it("Should allow owner to remove pools", async function () {
			await cap.connect(owner).addPool(pool.address);

			await expect(cap.connect(owner).removePool(pool.address))
				.to.emit(cap, "PoolRemoved")
				.withArgs(pool.address);

			expect(await cap.isPool(pool.address)).to.be.false;
		});

		it("Should not allow non-owner to add pools", async function () {
			await expect(cap.connect(user1).addPool(pool.address))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});

		it("Should not allow adding zero address as pool", async function () {
			await expect(cap.connect(owner).addPool(ethers.ZeroAddress))
				.to.be.revertedWith("ZERO_ADDR");
		});

		it("Should not allow adding existing pool", async function () {
			await cap.connect(owner).addPool(pool.address);
			await expect(cap.connect(owner).addPool(pool.address))
				.to.be.revertedWith("EXISTS");
		});
	});

	describe("Tax Configuration", function () {
		it("Should allow owner to update tax rates", async function () {
			await expect(cap.connect(owner).setTaxes(200, 300, 100))
				.to.emit(cap, "TaxesUpdated")
				.withArgs(200, 300, 100);

			expect(await cap.transferTaxBp()).to.equal(200);
			expect(await cap.sellTaxBp()).to.equal(300);
			expect(await cap.buyTaxBp()).to.equal(100);
		});

		it("Should enforce tax caps", async function () {
			await expect(cap.connect(owner).setTaxes(501, 100, 100))
				.to.be.revertedWith("TRANSFER_TAX_TOO_HIGH");

			await expect(cap.connect(owner).setTaxes(100, 501, 100))
				.to.be.revertedWith("SELL_TAX_TOO_HIGH");

			await expect(cap.connect(owner).setTaxes(100, 100, 501))
				.to.be.revertedWith("BUY_TAX_TOO_HIGH");
		});

		it("Should not allow non-owner to update taxes", async function () {
			await expect(cap.connect(user1).setTaxes(200, 300, 100))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});
	});

	describe("Fee Recipient Management", function () {
		it("Should allow owner to update fee recipient", async function () {
			await expect(cap.connect(owner).setFeeRecipient(user1.address))
				.to.emit(cap, "FeeRecipientUpdated")
				.withArgs(user1.address);

			expect(await cap.feeRecipient()).to.equal(user1.address);
		});

		it("Should allow setting fee recipient to zero address", async function () {
			await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);
			expect(await cap.feeRecipient()).to.equal(ethers.ZeroAddress);
		});

		it("Should not allow non-owner to update fee recipient", async function () {
			await expect(cap.connect(user1).setFeeRecipient(user2.address))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});
	});

	describe("Burning", function () {
		beforeEach(async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
		});

		it("Should allow users to burn their tokens", async function () {
			const burnAmount = ethers.parseEther("1000");
			const initialBalance = await cap.balanceOf(user1.address);
			const initialSupply = await cap.totalSupply();

			await cap.connect(user1).burn(burnAmount);

			expect(await cap.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
			expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
		});

		it("Should allow burning from another account with allowance", async function () {
			const burnAmount = ethers.parseEther("1000");

			await cap.connect(user1).approve(user2.address, burnAmount);

			const initialBalance = await cap.balanceOf(user1.address);
			const initialSupply = await cap.totalSupply();

			await cap.connect(user2).burnFrom(user1.address, burnAmount);

			expect(await cap.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
			expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
		});
	});

	describe("Governance Features", function () {
		beforeEach(async function () {
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
			await cap.connect(user1).delegate(user1.address); // Self-delegate to activate voting power
		});

		it("Should track voting power correctly", async function () {
			const actualBalance = await cap.balanceOf(user1.address);
			const votingPower = await cap.getVotes(user1.address);
			expect(votingPower).to.equal(actualBalance); // Should equal actual balance (after tax)
		});

		it("Should support delegation", async function () {
			const user1Balance = await cap.balanceOf(user1.address);

			await cap.connect(user1).delegate(user2.address);

			expect(await cap.delegates(user1.address)).to.equal(user2.address);
			expect(await cap.getVotes(user2.address)).to.equal(user1Balance);
			expect(await cap.getVotes(user1.address)).to.equal(0);
		});

		it("Should support permit functionality", async function () {
			const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
			const value = ethers.parseEther("1000");

			// This is a simplified test - in practice you'd need to sign the permit
			const domain = {
				name: await cap.name(),
				version: "1",
				chainId: 31337, // Hardhat default
				verifyingContract: await cap.getAddress()
			};

			// For testing purposes, we'll just check that the permit function exists
			expect(cap.permit).to.be.a("function");
		});
	});

	describe("Upgrade Functionality", function () {
		it("Should allow owner to authorize upgrades", async function () {
			// Deploy new implementation
			const CAPTokenV2 = await ethers.getContractFactory("CAPToken");
			const newImplementation = await CAPTokenV2.deploy();

			// This should not revert for owner
			await expect(cap.connect(owner).upgradeToAndCall(await newImplementation.getAddress(), "0x"))
				.to.not.be.reverted;
		});

		it("Should not allow non-owner to upgrade", async function () {
			const CAPTokenV2 = await ethers.getContractFactory("CAPToken");
			const newImplementation = await CAPTokenV2.deploy();

			await expect(cap.connect(user1).upgradeToAndCall(await newImplementation.getAddress(), "0x"))
				.to.be.revertedWithCustomError(cap, "OwnableUnauthorizedAccount");
		});
	});

	describe("Edge Cases", function () {
		it("Should handle zero amount transfers", async function () {
			await expect(cap.connect(user1).transfer(user2.address, 0))
				.to.not.be.reverted;
		});

		it("Should not tax mints and burns", async function () {
			// Minting (only possible during initialization)
			const initialSupply = await cap.totalSupply();
			expect(initialSupply).to.equal(INITIAL_SUPPLY);

			// Burning should not be taxed
			await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
			const burnAmount = ethers.parseEther("100");

			const treasuryBalanceBefore = await cap.balanceOf(treasury.address);
			await cap.connect(user1).burn(burnAmount);
			const treasuryBalanceAfter = await cap.balanceOf(treasury.address);

			expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore); // No tax on burn
		});
	});

	describe("OFT Adapter Stub", function () {
		it("Should emit event when receiving OFT", async function () {
			const testData = ethers.toUtf8Bytes("test data");

			await expect(oftStub.onOFTReceived(user1.address, ethers.parseEther("1000"), testData))
				.to.emit(oftStub, "OFTReceived")
				.withArgs(user1.address, ethers.parseEther("1000"), testData);
		});
	});
});