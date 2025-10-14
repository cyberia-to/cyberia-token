import { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";
import { CAPToken } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";

/**
 * Mainnet Fork Integration Tests
 *
 * These tests fork Ethereum mainnet to test integration with real DEX protocols.
 * To run these tests, you need a mainnet RPC URL set in .env:
 * MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
 *
 * Run with: npx hardhat test test/integration/MainnetFork.test.ts --network hardhat
 */
describe("Mainnet Fork Integration Tests", function () {
  let cap: CAPToken;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  // Uniswap V2 addresses on mainnet
  const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  // Uniswap V3 addresses
  const _UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
  const _UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  // Rich account to impersonate (Binance hot wallet)
  const RICH_ACCOUNT = "0x28C6c06298d514Db089934071355E5743bf21d60";

  before(async function () {
    // Check if we can fork mainnet
    const rpcUrl = process.env.MAINNET_RPC_URL;
    if (!rpcUrl || rpcUrl === "") {
      console.log("⚠️  Skipping mainnet fork tests - MAINNET_RPC_URL not configured");
      this.skip();
    }

    try {
      // Fork mainnet at a recent block
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: rpcUrl,
              blockNumber: 18000000, // Adjust to recent block
            },
          },
        ],
      });
    } catch (error) {
      console.log("⚠️  Could not fork mainnet:", error);
      this.skip();
    }
  });

  beforeEach(async function () {
    [owner, treasury, user1] = await ethers.getSigners();

    // Deploy CAP Token
    const CAP = await ethers.getContractFactory("CAPToken");
    cap = (await upgrades.deployProxy(CAP, [owner.address, treasury.address], {
      kind: "uups",
      initializer: "initialize",
    })) as unknown as CAPToken;

    // Give some tokens to test users
    await cap.connect(owner).transfer(user1.address, ethers.parseEther("1000000"));
  });

  describe("Uniswap V2 Integration", function () {
    it("Should create a Uniswap V2 pair and add liquidity", async function () {
      const IUniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY);

      const IUniswapV2Router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER);

      // Create pair
      const tx = await IUniswapV2Factory.createPair(await cap.getAddress(), WETH);
      await tx.wait();

      const pairAddress = await IUniswapV2Factory.getPair(await cap.getAddress(), WETH);
      expect(pairAddress).to.not.equal(ethers.ZeroAddress);

      // Register pair as pool for tax purposes
      await cap.connect(owner).addPool(pairAddress);

      // Approve router
      await cap.connect(owner).approve(UNISWAP_V2_ROUTER, ethers.parseEther("100000"));

      // Add liquidity (requires ETH)
      const tokenAmount = ethers.parseEther("50000");
      const ethAmount = ethers.parseEther("10");

      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await IUniswapV2Router.addLiquidityETH(
        await cap.getAddress(),
        tokenAmount,
        0, // amountTokenMin
        0, // amountETHMin
        owner.address,
        deadline,
        { value: ethAmount }
      );

      // Verify liquidity was added
      const IUniswapV2Pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
      const reserves = await IUniswapV2Pair.getReserves();

      expect(reserves[0]).to.be.gt(0);
      expect(reserves[1]).to.be.gt(0);
    });

    it("Should apply sell tax when swapping CAP for ETH on Uniswap V2", async function () {
      // Setup: Create pair and add liquidity (similar to above)
      const IUniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY);

      const IUniswapV2Router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER);

      await IUniswapV2Factory.createPair(await cap.getAddress(), WETH);
      const pairAddress = await IUniswapV2Factory.getPair(await cap.getAddress(), WETH);

      // Register pair
      await cap.connect(owner).addPool(pairAddress);

      // Add liquidity
      await cap.connect(owner).approve(UNISWAP_V2_ROUTER, ethers.parseEther("100000"));
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await IUniswapV2Router.addLiquidityETH(
        await cap.getAddress(),
        ethers.parseEther("50000"),
        0,
        0,
        owner.address,
        deadline,
        { value: ethers.parseEther("10") }
      );

      // Now test swap (sell CAP for ETH)
      const swapAmount = ethers.parseEther("1000");
      await cap.connect(user1).approve(UNISWAP_V2_ROUTER, swapAmount);

      const treasuryBefore = await cap.balanceOf(treasury.address);

      await IUniswapV2Router.connect(user1).swapExactTokensForETHSupportingFeeOnTransferTokens(
        swapAmount,
        0, // amountOutMin
        [await cap.getAddress(), WETH],
        user1.address,
        deadline
      );

      const treasuryAfter = await cap.balanceOf(treasury.address);

      // Should have collected sell tax (transfer + sell = 2%)
      const expectedTax = (swapAmount * 200n) / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedTax);
    });

    it("Should apply no tax when buying CAP with ETH on Uniswap V2", async function () {
      // Setup pair and liquidity
      const IUniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY);

      const IUniswapV2Router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER);

      await IUniswapV2Factory.createPair(await cap.getAddress(), WETH);
      const pairAddress = await IUniswapV2Factory.getPair(await cap.getAddress(), WETH);

      await cap.connect(owner).addPool(pairAddress);
      await cap.connect(owner).approve(UNISWAP_V2_ROUTER, ethers.parseEther("100000"));

      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await IUniswapV2Router.addLiquidityETH(
        await cap.getAddress(),
        ethers.parseEther("50000"),
        0,
        0,
        owner.address,
        deadline,
        { value: ethers.parseEther("10") }
      );

      // Buy CAP with ETH
      const treasuryBefore = await cap.balanceOf(treasury.address);
      const user1Before = await cap.balanceOf(user1.address);

      await IUniswapV2Router.connect(user1).swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, // amountOutMin
        [WETH, await cap.getAddress()],
        user1.address,
        deadline,
        { value: ethers.parseEther("1") }
      );

      const treasuryAfter = await cap.balanceOf(treasury.address);
      const user1After = await cap.balanceOf(user1.address);

      // Buy tax is 0%, so treasury should not receive tax
      expect(treasuryAfter).to.equal(treasuryBefore);

      // User should receive tokens
      expect(user1After).to.be.gt(user1Before);
    });
  });

  describe("Real WETH Integration", function () {
    it("Should handle wrapped ETH correctly", async function () {
      const IWETH = await ethers.getContractAt("IWETH9", WETH);

      // Wrap some ETH
      const wrapAmount = ethers.parseEther("5");
      await IWETH.connect(user1).deposit({ value: wrapAmount });

      expect(await IWETH.balanceOf(user1.address)).to.equal(wrapAmount);

      // Unwrap
      await IWETH.connect(user1).withdraw(wrapAmount);

      expect(await IWETH.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe("Impersonation Tests", function () {
    it("Should test with impersonated rich account", async function () {
      // Impersonate a rich account
      await impersonateAccount(RICH_ACCOUNT);
      await setBalance(RICH_ACCOUNT, ethers.parseEther("100"));

      const richSigner = await ethers.getSigner(RICH_ACCOUNT);

      // Give CAP tokens to rich account
      await cap.connect(owner).transfer(RICH_ACCOUNT, ethers.parseEther("10000"));

      expect(await cap.balanceOf(RICH_ACCOUNT)).to.be.gt(0);

      // Rich account can transfer
      await cap.connect(richSigner).transfer(user1.address, ethers.parseEther("1000"));

      // Verify tax was applied
      const treasuryBalance = await cap.balanceOf(treasury.address);
      expect(treasuryBalance).to.be.gt(0);
    });
  });

  describe("Gas Efficiency on Mainnet Fork", function () {
    it("Should measure real-world gas costs for swaps", async function () {
      const IUniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", UNISWAP_V2_FACTORY);

      const IUniswapV2Router = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER);

      // Create pair
      await IUniswapV2Factory.createPair(await cap.getAddress(), WETH);
      const pairAddress = await IUniswapV2Factory.getPair(await cap.getAddress(), WETH);
      await cap.connect(owner).addPool(pairAddress);

      // Add liquidity
      await cap.connect(owner).approve(UNISWAP_V2_ROUTER, ethers.parseEther("100000"));
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const liquidityTx = await IUniswapV2Router.addLiquidityETH(
        await cap.getAddress(),
        ethers.parseEther("50000"),
        0,
        0,
        owner.address,
        deadline,
        { value: ethers.parseEther("10") }
      );
      const liquidityReceipt = await liquidityTx.wait();

      console.log("    Gas used for adding liquidity:", liquidityReceipt?.gasUsed.toString());

      // Perform swap
      await cap.connect(user1).approve(UNISWAP_V2_ROUTER, ethers.parseEther("1000"));

      const swapTx = await IUniswapV2Router.connect(user1).swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.parseEther("1000"),
        0,
        [await cap.getAddress(), WETH],
        user1.address,
        deadline
      );
      const swapReceipt = await swapTx.wait();

      console.log("    Gas used for swap with tax:", swapReceipt?.gasUsed.toString());

      // Verify gas is reasonable
      expect(swapReceipt?.gasUsed).to.be.lt(500000);
    });
  });
});

// Minimal interface definitions for Uniswap contracts
const _IUniswapV2FactoryABI = [
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
];

const _IUniswapV2Router02ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
];

const _IUniswapV2PairABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

const _IWETH9ABI = [
  "function deposit() external payable",
  "function withdraw(uint wad) external",
  "function balanceOf(address account) external view returns (uint256)",
];

// Extend ethers contract factory
declare module "ethers" {
  interface ContractRunner {
    getContractAt(name: "IUniswapV2Factory", address: string): Promise<any>;
    getContractAt(name: "IUniswapV2Router02", address: string): Promise<any>;
    getContractAt(name: "IUniswapV2Pair", address: string): Promise<any>;
    getContractAt(name: "IWETH9", address: string): Promise<any>;
  }
}
