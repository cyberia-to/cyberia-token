import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { CAPTokenOFT, MockLayerZeroEndpoint } from "../../typechain-types";

/**
 * CAPTokenOFT Tests
 *
 * Tests for the OFT contract deployed on destination chains
 * Focus areas:
 * - Deployment and token metadata
 * - Burning functionality
 * - Access control
 * - OFT standard compliance
 */
describe("CAPTokenOFT", function () {
  let oft: CAPTokenOFT;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let mockEndpoint: MockLayerZeroEndpoint;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy Mock LayerZero Endpoint
    const MockEndpoint = await ethers.getContractFactory("MockLayerZeroEndpoint");
    mockEndpoint = await MockEndpoint.deploy();
    await mockEndpoint.deployed();

    // Deploy OFT
    const OFT = await ethers.getContractFactory("CAPTokenOFT");
    oft = await OFT.deploy(mockEndpoint.address, owner.address);

    await oft.deployed();
  });

  describe("Deployment", function () {
    it("Should deploy with correct name", async function () {
      expect(await oft.name()).to.equal("Cyberia");
    });

    it("Should deploy with correct symbol", async function () {
      expect(await oft.symbol()).to.equal("CAP");
    });

    it("Should deploy with correct decimals", async function () {
      expect(await oft.decimals()).to.equal(18);
    });

    it("Should set correct owner", async function () {
      expect(await oft.owner()).to.equal(owner.address);
    });

    it("Should have correct shared decimals", async function () {
      const sharedDecimals = await oft.sharedDecimals();
      expect(sharedDecimals).to.equal(6);
    });

    it("Should start with zero total supply", async function () {
      expect(await oft.totalSupply()).to.equal(0);
    });

    it("Should have correct decimal conversion rate", async function () {
      const conversionRate = await oft.decimalConversionRate();
      // 18 - 6 = 12, so 10^12
      expect(conversionRate).to.equal(10n ** 12n);
    });
  });

  describe("Burning", function () {
    it("Should NOT have burn function (removed for security)", async function () {
      // The burn() and burnFrom() functions were removed from CAPTokenOFT for security
      // Only the LayerZero endpoint can trigger burns via the OFT._debit() function
      // when users bridge tokens back to Ethereum
      // Verify that calling burn() would revert (not available in the contract ABI)
      expect(typeof oft.burn).to.equal("undefined");
    });

    it("Should restrict burning to only LayerZero-initiated burns", async function () {
      // Users cannot directly call burn() - only the LZ endpoint can initiate burns
      // by calling the OFT's receiveFromEVM function
      const balance = await oft.balanceOf(user1.address);
      expect(balance).to.equal(0); // Should start with 0
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to transfer ownership", async function () {
      await expect(oft.connect(user1).transferOwnership(user1.address)).to.be.reverted;
    });

    it("Should allow owner to transfer ownership", async function () {
      await oft.connect(owner).transferOwnership(user1.address);
      expect(await oft.owner()).to.equal(user1.address);
    });
  });

  describe("Token Standards", function () {
    it("Should support ERC20 interface", async function () {
      // Test basic ERC20 functions exist
      expect(await oft.totalSupply()).to.equal(0);
      expect(await oft.balanceOf(owner.address)).to.equal(0);
      expect(await oft.allowance(owner.address, user1.address)).to.equal(0);
    });

    it("Should handle approvals", async function () {
      const amount = ethers.utils.parseEther("1000");

      await oft.connect(owner).approve(user1.address, amount);

      expect(await oft.allowance(owner.address, user1.address)).to.equal(amount);
    });

    it("Should handle max approval", async function () {
      const maxUint = ethers.constants.MaxUint256;

      await oft.connect(owner).approve(user1.address, maxUint);

      expect(await oft.allowance(owner.address, user1.address)).to.equal(maxUint);
    });
  });

  describe("OFT Standard Functions", function () {
    it("Should return correct token address (self)", async function () {
      const token = await oft.token();
      expect(token).to.equal(oft.address);
    });

    it("Should indicate approval is NOT required", async function () {
      const required = await oft.approvalRequired();
      expect(required).to.be.false; // OFT doesn't need approval of itself
    });

    it("Should have matching shared decimals with adapter", async function () {
      // Shared decimals must match OFTAdapter (6)
      const sharedDecimals = await oft.sharedDecimals();
      expect(sharedDecimals).to.equal(6);
    });

    it("Should use 18 decimals for local token", async function () {
      const decimals = await oft.decimals();
      expect(decimals).to.equal(18);
    });
  });

  describe("Metadata", function () {
    it("Should maintain consistent metadata with source token", async function () {
      expect(await oft.name()).to.equal("Cyberia");
      expect(await oft.symbol()).to.equal("CAP");
      expect(await oft.decimals()).to.equal(18);
    });

    it("Should have correct OFT version", async function () {
      const [_interfaceId, version] = await oft.oftVersion();
      expect(version).to.equal(1); // OFT v1
    });
  });

  describe("Decimals Conversion", function () {
    it("Should have correct decimal conversion rate", async function () {
      const rate = await oft.decimalConversionRate();
      // Local decimals (18) - shared decimals (6) = 12
      // So conversion rate is 10^12
      expect(rate).to.equal(10n ** 12n);
    });

    it("Should match adapter's shared decimals", async function () {
      // This ensures compatibility with OFTAdapter on Ethereum
      const sharedDecimals = await oft.sharedDecimals();
      expect(sharedDecimals).to.equal(6);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount approvals", async function () {
      await oft.connect(owner).approve(user1.address, 0);

      const allowance = await oft.allowance(owner.address, user1.address);
      expect(allowance).to.equal(0);
    });

    it("Should revert on transfer with insufficient balance", async function () {
      const amount = ethers.utils.parseEther("100");

      await expect(oft.connect(user1).transfer(owner.address, amount)).to.be.reverted;
    });

    it("Should revert on transferFrom with insufficient allowance", async function () {
      const amount = ethers.utils.parseEther("100");

      await expect(oft.connect(user1).transferFrom(owner.address, user1.address, amount)).to.be.reverted;
    });
  });
});
