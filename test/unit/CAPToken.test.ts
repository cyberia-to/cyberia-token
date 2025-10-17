import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CAPToken, OFTAdapterStub, MockDEXPair } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CAPToken", function () {
  let cap: CAPToken;
  let oftStub: OFTAdapterStub;
  let mockPool: MockDEXPair;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1B tokens
  const _BASIS_POINTS_DENOMINATOR = 10000;

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    // Deploy CAP Token
    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Deploy OFT Adapter Stub
    const OFTStub = await ethers.getContractFactory("OFTAdapterStub");
    oftStub = (await upgrades.deployProxy(OFTStub, [owner.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as OFTAdapterStub;

    // Deploy Mock DEX Pair for pool testing
    const MockDEXPair = await ethers.getContractFactory("MockDEXPair");
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH
    mockPool = await MockDEXPair.deploy(await cap.getAddress(), WETH);
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
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("100000"));
      await cap.connect(owner).transfer(user2.address, ethers.parseEther("100000"));
    });

    it("Should apply transfer tax on user-to-user transfers", async function () {
      const transferAmount = ethers.parseEther("1000");
      const expectedTax = (transferAmount * 100n) / 10000n; // 1%
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
      const poolAddress = await mockPool.getAddress();
      await cap.connect(owner).addPool(poolAddress);

      const transferAmount = ethers.parseEther("1000");
      const transferTax = (transferAmount * 100n) / 10000n; // 1% transfer tax
      const sellTax = (transferAmount * 100n) / 10000n; // 1% sell tax
      const totalTax = transferTax + sellTax; // 2% total
      const expectedNet = transferAmount - totalTax;

      const user1InitialBalance = await cap.balanceOf(user1.address);
      const poolInitialBalance = await cap.balanceOf(poolAddress);
      const treasuryInitialBalance = await cap.balanceOf(treasury.address);

      await cap.connect(user1).transfer(poolAddress, transferAmount);

      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance - transferAmount);
      expect(await cap.balanceOf(poolAddress)).to.equal(poolInitialBalance + expectedNet);
      expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance + totalTax);
    });

    it("Should apply no tax when transferring from pool (buy)", async function () {
      // Add pool and give it tokens
      const poolAddress = await mockPool.getAddress();
      await cap.connect(owner).addPool(poolAddress);
      await cap.connect(owner).transfer(poolAddress, ethers.parseEther("10000"));

      const transferAmount = ethers.parseEther("1000");

      const poolInitialBalance = await cap.balanceOf(poolAddress);
      const user1InitialBalance = await cap.balanceOf(user1.address);
      const treasuryInitialBalance = await cap.balanceOf(treasury.address);

      // Impersonate the pool contract to send tokens
      await ethers.provider.send("hardhat_impersonateAccount", [poolAddress]);
      await ethers.provider.send("hardhat_setBalance", [poolAddress, "0x1000000000000000000"]); // Give pool ETH for gas
      const poolSigner = await ethers.getSigner(poolAddress);

      await cap.connect(poolSigner).transfer(user1.address, transferAmount);

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [poolAddress]);

      expect(await cap.balanceOf(poolAddress)).to.equal(poolInitialBalance - transferAmount);
      expect(await cap.balanceOf(user1.address)).to.equal(user1InitialBalance + transferAmount);
      expect(await cap.balanceOf(treasury.address)).to.equal(treasuryInitialBalance); // No change
    });

    it("Should burn taxes when fee recipient is zero address", async function () {
      // Set fee recipient to zero address
      await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);

      const transferAmount = ethers.parseEther("1000");
      const expectedTax = (transferAmount * 100n) / 10000n; // 1%

      const initialSupply = await cap.totalSupply();

      await cap.connect(user1).transfer(user2.address, transferAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply - expectedTax);
    });
  });

  describe("Pool Management", function () {
    it("Should allow owner to add and remove pools", async function () {
      const poolAddress = await mockPool.getAddress();

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
      await cap.connect(owner).setFeeRecipient(ethers.ZeroAddress);
      expect(await cap.feeRecipient()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));

      const burnAmount = ethers.parseEther("1000");
      const initialBalance = await cap.balanceOf(user1.address);
      const initialSupply = await cap.totalSupply();

      await cap.connect(user1).burn(burnAmount);

      expect(await cap.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await cap.totalSupply()).to.equal(initialSupply - burnAmount);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to propose and execute mint", async function () {
      const mintAmount = ethers.parseEther("1000000");
      const initialSupply = await cap.totalSupply();
      const initialBalance = await cap.balanceOf(user1.address);

      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint()).to.emit(cap, "TokensMinted").withArgs(user1.address, mintAmount);

      expect(await cap.totalSupply()).to.equal(initialSupply + mintAmount);
      expect(await cap.balanceOf(user1.address)).to.equal(initialBalance + mintAmount);
    });

    it("Should not allow proposing mint to zero address", async function () {
      const mintAmount = ethers.parseEther("1000000");

      await expect(cap.connect(owner).proposeMint(ethers.ZeroAddress, mintAmount)).to.be.revertedWith("MINT_TO_ZERO");
    });

    it("Should emit canonical Transfer event when minting", async function () {
      const mintAmount = ethers.parseEther("1000000");

      await cap.connect(owner).proposeMint(user1.address, mintAmount);

      // Fast forward 7 days
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(cap.connect(owner).executeMint())
        .to.emit(cap, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, mintAmount);
    });

    it("Should not apply tax when minting", async function () {
      const mintAmount = ethers.parseEther("1000000");
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
  });

  describe("Governance Features", function () {
    it("Should track voting power correctly after delegation", async function () {
      await cap.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
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

      await expect(cap.connect(owner).upgradeToAndCall(await newImplementation.getAddress(), "0x")).to.not.be.reverted;
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
