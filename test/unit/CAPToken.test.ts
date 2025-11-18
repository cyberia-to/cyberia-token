import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken, MockDEXPair } from "../typechain-types";
import { Signer } from "ethers";

describe("CAPToken", function () {
  let cap: CAPToken;
  let mockPool: MockDEXPair;
  let owner: Signer;
  let treasury: Signer;
  let user1: Signer;
  let user2: Signer;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1B tokens
  const _BASIS_POINTS_DENOMINATOR = 10000;

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    // Deploy CAP Token
    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Deploy Mock DEX Pair for pool testing
    const MockDEXPair = await ethers.getContractFactory("MockDEXPair");
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH
    mockPool = await MockDEXPair.deploy(cap.address, WETH);
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
      expect(await cap.governance()).to.equal(owner.address);
    });
  });

  describe("Tax System", function () {
    beforeEach(async function () {
      // Distribute tokens for testing
      await cap.connect(owner).transfer(user1.address, ethers.utils.parseEther("100000"));
      await cap.connect(owner).transfer(user2.address, ethers.utils.parseEther("100000"));
    });

    it("Should apply transfer tax on user-to-user transfers", async function () {
      const transferAmount = ethers.utils.parseEther("1000");
      const expectedTax = transferAmount.mul(100).div(10000); // 1%
      const expectedNet = transferAmount.sub(expectedTax);

      const user1InitialBalance = await cap.balanceOf(user1.address);
      const user2InitialBalance = await cap.balanceOf(user2.address);
      const treasuryInitialBalance = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(user2.address, transferAmount);

      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance.sub(transferAmount));
      expect(await cap.balanceOf(user2.address)).to.equal(user2InitialBalance.add(expectedNet));
      expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance.add(expectedTax));
    });

    it("Should apply sell tax when transferring to pool", async function () {
      // Add pool
      const poolAddress = mockPool.address;
      await cap.connect(owner).addPool(poolAddress);

      const transferAmount = ethers.utils.parseEther("1000");
      const transferTax = transferAmount.mul(100).div(10000); // 1% transfer tax
      const sellTax = transferAmount.mul(100).div(10000); // 1% sell tax
      const totalTax = transferTax.add(sellTax); // 2% total
      const expectedNet = transferAmount.sub(totalTax);

      const user1InitialBalance = await cap.balanceOf(user1.address);
      const poolInitialBalance = await cap.balanceOf(poolAddress);
      const treasuryInitialBalance = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(poolAddress, transferAmount);

      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance.sub(transferAmount));
      expect(await cap.balanceOf(poolAddress)).to.equal(poolInitialBalance.add(expectedNet));
      expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance.add(totalTax));
    });

    it("Should apply no tax when transferring from pool (buy)", async function () {
      // Add pool and give it tokens
      const poolAddress = mockPool.address;
      await cap.connect(owner).addPool(poolAddress);
      await cap.connect(owner).transfer(poolAddress, ethers.utils.parseEther("10000"));

      const transferAmount = ethers.utils.parseEther("1000");

      const poolInitialBalance = await cap.balanceOf(poolAddress);
      const user1InitialBalance = await cap.balanceOf(user1.address);
      const treasuryInitialBalance = await cap.balanceOf(treasury.address);

      // Impersonate the pool contract to send tokens
      await ethers.provider.send("hardhat_impersonateAccount", [poolAddress]);
      await ethers.provider.send("hardhat_setBalance", [poolAddress, "0x1000000000000000000"]); // Give pool ETH for gas
      const poolSigner = await ethers.getSigner(poolAddress);

      await cap.connect(poolSigner).transfer(user1.address, transferAmount);

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [poolAddress]);

      expect(await cap.balanceOf(poolAddress)).to.equal(poolInitialBalance.sub(transferAmount));
      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance.add(transferAmount));
      expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance); // No change
    });

    it("Should burn taxes when fee recipient is zero address", async function () {
      // Set fee recipient to zero address
      await cap.connect(owner).setFeeRecipient(ethers.constants.AddressZero);

      const transferAmount = ethers.utils.parseEther("1000");
      const expectedTax = transferAmount.mul(100).div(10000); // 1%

      const initialSupply = await cap.totalSupply();

      await cap.connect(user1).transfer(user2.address, transferAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply.sub(expectedTax));
    });
  });

  describe("Pool Management", function () {
    it("Should allow owner to add and remove pools", async function () {
      const poolAddress = mockPool.address;

      // Add pool
      await expect(cap.connect(owner).addPool(poolAddress)).to.emit(cap, "PoolAdded").withArgs(poolAddress);
      expect(await cap.isPool(poolAddress)).to.be.true;

      // Remove pool
      await expect(cap.connect(owner).removePool(poolAddress)).to.emit(cap, "PoolRemoved").withArgs(poolAddress);
      expect(await cap.isPool(poolAddress)).to.be.false;
    });
  });

  describe("Tax Configuration", function () {
    it("Should allow owner to propose and apply tax rates with timelock", async function () {
      await cap.connect(owner).proposeTaxChange(200, 300, 100);

      // Fast forward 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).applyTaxChange()).to.emit(cap, "TaxesUpdated").withArgs(200, 300, 100);

      expect(await cap.transferTaxBp()).to.equal(200);
      expect(await cap.sellTaxBp()).to.equal(300);
      expect(await cap.buyTaxBp()).to.equal(100);
    });

    it("Should enforce combined tax cap for sell scenario", async function () {
      // Combined cap is 800 bp (8%), so transfer + sell must be <= 800
      // Individual cap is 500 bp (5%)

      // Test at combined limit (400 + 400 = 800)
      await expect(cap.connect(owner).proposeTaxChange(400, 400, 0)).to.not.be.reverted;

      // Test exceeding combined limit (450 + 400 = 850, exceeds 800 combined cap)
      await expect(cap.connect(owner).proposeTaxChange(450, 400, 0)).to.be.revertedWith("COMBINED_SELL_TAX_TOO_HIGH");

      // Test exceeding combined limit (400 + 450 = 850, exceeds 800 combined cap)
      await expect(cap.connect(owner).proposeTaxChange(400, 450, 0)).to.be.revertedWith("COMBINED_SELL_TAX_TOO_HIGH");

      // Test just under combined limit (399 + 400 = 799)
      await expect(cap.connect(owner).proposeTaxChange(399, 400, 0)).to.not.be.reverted;

      // Test buy tax doesn't affect combined cap (400 + 400 + 500 where 400+400=800 for sell)
      await expect(cap.connect(owner).proposeTaxChange(400, 400, 500)).to.not.be.reverted; // Buy tax doesn't affect combined cap
    });
  });

  describe("Fee Recipient Management", function () {
    it("Should allow owner to update fee recipient", async function () {
      await expect(cap.connect(owner).setFeeRecipient(user1.address))
        .to.emit(cap, "FeeRecipientUpdated")
        .withArgs(treasury.address, user1.address);

      expect(await cap.feeRecipient()).to.equal(user1.address);
    });

    it("Should allow setting fee recipient to zero address", async function () {
      await cap.connect(owner).setFeeRecipient(ethers.constants.AddressZero);
      expect(await cap.feeRecipient()).to.equal(ethers.constants.AddressZero);
    });

    it("Should prevent setting contract itself as fee recipient", async function () {
      // Security check: prevent infinite loops or accidentally redirecting fees to contract
      await expect(cap.connect(owner).setFeeRecipient(cap.address)).to.be.revertedWith(
        "FEE_RECIPIENT_CANNOT_BE_CONTRACT"
      );
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.utils.parseEther("10000"));

      const burnAmount = ethers.utils.parseEther("1000");
      const initialBalance = await cap.balanceOf(user1.address);
      const initialSupply = await cap.totalSupply();

      await cap.connect(user1).burn(burnAmount);

      expect(await cap.balanceOf(user1.address)).to.equal(initialBalance.sub(burnAmount));
      expect(await cap.totalSupply()).to.equal(initialSupply.sub(burnAmount));
    });
  });

  describe("Minting", function () {
    it("Should allow owner to propose and execute mint", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");
      const initialSupply = await cap.totalSupply();
      const initialBalance = await cap.balanceOf(user1.address);

      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint()).to.emit(cap, "TokensMinted").withArgs(user1.address, mintAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply.add(mintAmount));
      expect(await cap.balanceOf(user1.address)).to.equal(initialBalance.add(mintAmount));
    });

    it("Should not allow proposing mint to zero address", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");

      await expect(cap.connect(owner).proposeMint(ethers.constants.AddressZero, mintAmount)).to.be.revertedWith(
        "MINT_TO_ZERO"
      );
    });

    it("Should emit canonical Transfer event when minting", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");

      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint())
        .to.emit(cap, "Transfer")
        .withArgs(ethers.constants.AddressZero, user1.address, mintAmount);
    });

    it("Should not apply tax when minting", async function () {
      const mintAmount = ethers.utils.parseEther("1000000");
      const initialTreasuryBalance = await cap.balanceOf(treasury.address);

      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await cap.connect(owner).executeMint();

      // Treasury balance should not change (no tax on mint)
      expect(await cap.balanceOf(treasury.address)).to.equal(initialTreasuryBalance);
      // User should receive full mint amount
      expect(await cap.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should enforce rolling window mint cap (30-day period)", async function () {
      // Max mint per 30 days = 100M tokens

      // First mint: propose and execute 50M
      const firstMint = ethers.utils.parseEther("50000000");
      await cap.connect(owner).proposeMint(user1.address, firstMint);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).executeMint();

      // Second mint: propose and execute another 50M (still in same period = 100M total)
      const secondMint = ethers.utils.parseEther("50000000");
      await cap.connect(owner).proposeMint(user2.address, secondMint);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 more days (14 days total)
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).executeMint();

      // Third mint: should fail (exceeds 100M cap for 30-day period)
      const thirdMint = ethers.utils.parseEther("1");
      await expect(cap.connect(owner).proposeMint(user1.address, thirdMint)).to.be.revertedWith(
        "EXCEEDS_MINT_CAP_PER_PERIOD"
      );
    });

    it("Should reset mint cap after rolling 30-day period expires", async function () {
      // This test documents that the rolling window mint cap resets after 30 days
      // Start by minting up to the cap in the first period
      const fullCap = ethers.utils.parseEther("100000000"); // 100M cap per 30 days

      // Proposal 1: Mint 100M (uses the full cap)
      await cap.connect(owner).proposeMint(user1.address, fullCap);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).executeMint(); // Actually increments mintedInCurrentPeriod

      // Verify the cap is now exhausted (trying to mint any amount should fail)
      const tinyAmount = ethers.utils.parseEther("1");
      await expect(cap.connect(owner).proposeMint(user2.address, tinyAmount)).to.be.revertedWith(
        "EXCEEDS_MINT_CAP_PER_PERIOD"
      );

      // Now move forward exactly 30 days to reset the period
      // Current time is 7 days, need to go to 7 + 30 = 37 days from initial start
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // Advance 30 more days
      await ethers.provider.send("evm_mine", []);

      // Now the 30-day period should have reset, and we can mint again
      const secondPeriodMint = ethers.utils.parseEther("50000000");
      await cap.connect(owner).proposeMint(user2.address, secondPeriodMint);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await expect(cap.connect(owner).executeMint()).to.not.be.reverted;
    });

    it("Should handle rolling window correctly (multiple periods)", async function () {
      const halfCap = ethers.utils.parseEther("50000000");

      // Period 1: mint 100M total (at the cap)
      await cap.connect(owner).proposeMint(user1.address, halfCap);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).executeMint();

      await cap.connect(owner).proposeMint(user2.address, halfCap);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await cap.connect(owner).executeMint();

      // Period 2: skip ahead 30 days from first mint to reset
      await ethers.provider.send("evm_increaseTime", [16 * 24 * 60 * 60]); // More than 30 days from first mint
      await ethers.provider.send("evm_mine", []);

      // Should be able to mint MINT_CAP again (period has rolled)
      await cap.connect(owner).proposeMint(user1.address, halfCap);
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await expect(cap.connect(owner).executeMint()).to.not.be.reverted;
    });
  });

  describe("Governance Features", function () {
    it("Should track voting power correctly after delegation", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.utils.parseEther("10000"));
      await cap.connect(user1).delegate(user1.address);

      const actualBalance = await cap.balanceOf(user1.address);
      const votingPower = await cap.getVotes(user1.address);
      expect(votingPower).to.equal(actualBalance);
    });

    it("Should support permit functionality", async function () {
      expect(cap.permit).to.be.a("function");
    });
  });

  describe("Upgrade Functionality", function () {
    it("Should allow owner to authorize upgrades", async function () {
      const CAPTokenV2 = await ethers.getContractFactory("CAPToken");
      const newImplementation = await CAPTokenV2.deploy();

      await expect(cap.connect(owner).upgradeToAndCall(newImplementation.address, "0x")).to.not.be.reverted;
    });
  });
});
