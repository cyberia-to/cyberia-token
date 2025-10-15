# Solidity API

## CAPToken

### BASIS_POINTS_DENOMINATOR

```solidity
uint256 BASIS_POINTS_DENOMINATOR
```

### MAX_TAX_BP

```solidity
uint256 MAX_TAX_BP
```

### MAX_COMBINED_TAX_BP

```solidity
uint256 MAX_COMBINED_TAX_BP
```

### INITIAL_SUPPLY

```solidity
uint256 INITIAL_SUPPLY
```

### MAX_SUPPLY

```solidity
uint256 MAX_SUPPLY
```

### TAX_CHANGE_DELAY

```solidity
uint256 TAX_CHANGE_DELAY
```

### transferTaxBp

```solidity
uint256 transferTaxBp
```

### sellTaxBp

```solidity
uint256 sellTaxBp
```

### buyTaxBp

```solidity
uint256 buyTaxBp
```

### pendingTransferTaxBp

```solidity
uint256 pendingTransferTaxBp
```

### pendingSellTaxBp

```solidity
uint256 pendingSellTaxBp
```

### pendingBuyTaxBp

```solidity
uint256 pendingBuyTaxBp
```

### taxChangeTimestamp

```solidity
uint256 taxChangeTimestamp
```

### feeRecipient

```solidity
address feeRecipient
```

### isPool

```solidity
mapping(address => bool) isPool
```

### PoolAdded

```solidity
event PoolAdded(address pool)
```

### PoolRemoved

```solidity
event PoolRemoved(address pool)
```

### TaxChangeProposed

```solidity
event TaxChangeProposed(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp, uint256 effectiveTime)
```

### TaxChangeCancelled

```solidity
event TaxChangeCancelled(uint256 cancelledTransferTaxBp, uint256 cancelledSellTaxBp, uint256 cancelledBuyTaxBp)
```

### TaxesUpdated

```solidity
event TaxesUpdated(uint256 transferTaxBp, uint256 sellTaxBp, uint256 buyTaxBp)
```

### FeeRecipientUpdated

```solidity
event FeeRecipientUpdated(address oldRecipient, address newRecipient)
```

### TaxBurned

```solidity
event TaxBurned(address from, address to, uint256 grossAmount, uint256 taxAmount)
```

### TaxCollected

```solidity
event TaxCollected(address from, address to, uint256 grossAmount, uint256 taxAmount, address recipient)
```

### TokensMinted

```solidity
event TokensMinted(address to, uint256 amount)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address _owner, address _feeRecipient) public
```

Initialize the token contract

#### Parameters

| Name           | Type    | Description                                                                                               |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| \_owner        | address | The initial owner address (typically the DAO governance contract)                                         |
| \_feeRecipient | address | The fee recipient address. Use address(0) to enable burn mode where taxes are burned instead of collected |

### proposeTaxChange

```solidity
function proposeTaxChange(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp) external
```

Propose new tax rates (requires timelock delay before applying)

### applyTaxChange

```solidity
function applyTaxChange() external
```

Apply pending tax changes after timelock delay

### cancelTaxChange

```solidity
function cancelTaxChange() external
```

Cancel a pending tax change before it takes effect

_Allows governance to abort a proposed tax change during the timelock period_

### setTaxesImmediate

```solidity
function setTaxesImmediate(uint256 _transferTaxBp, uint256 _sellTaxBp, uint256 _buyTaxBp) external
```

Set taxes immediately (for initialization or emergency - use with caution)

_This bypasses the timelock and should only be used during initial setup_

### setFeeRecipient

```solidity
function setFeeRecipient(address _feeRecipient) external
```

Update the fee recipient address

#### Parameters

| Name           | Type    | Description                                                                                                   |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| \_feeRecipient | address | The new fee recipient address. Use address(0) to enable burn mode where taxes are burned instead of collected |

### addPool

```solidity
function addPool(address pool) external
```

### removePool

```solidity
function removePool(address pool) external
```

### burn

```solidity
function burn(uint256 amount) external
```

### burnFrom

```solidity
function burnFrom(address account, uint256 amount) external
```

### mint

```solidity
function mint(address to, uint256 amount) external
```

Mint new tokens - restricted to owner for future bridging/OFT needs

_Only callable by owner (DAO governance). Uses canonical \_mint() which emits Transfer(0x0, to, amount)_

#### Parameters

| Name   | Type    | Description                      |
| ------ | ------- | -------------------------------- |
| to     | address | Address to receive minted tokens |
| amount | uint256 | Amount of tokens to mint         |

### \_update

```solidity
function _update(address from, address to, uint256 value) internal
```

### \_authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

\_Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
{upgradeToAndCall}.

Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.

````solidity
function _authorizeUpgrade(address) internal onlyOwner {}
```_

### nonces

```solidity
function nonces(address owner) public view returns (uint256)
````

### \_maxSupply

```solidity
function _maxSupply() internal pure returns (uint256)
```

\_Maximum token supply. Defaults to `type(uint208).max` (2^208^ - 1).

This maximum is enforced in {_update}. It limits the total supply of the token, which is otherwise a uint256,
so that checkpoints can be stored in the Trace208 structure used by {Votes}. Increasing this value will not
remove the underlying limitation, and will cause {\_update} to fail because of a math overflow in
{Votes-\_transferVotingUnits}. An override could be used to further restrict the total supply (to a lower value) if
additional logic requires it. When resolving override conflicts on this function, the minimum should be
returned._

## IOFTAdapterHook

### onOFTReceived

```solidity
function onOFTReceived(address from, uint256 amount, bytes data) external
```

## OFTAdapterStub

### OFTReceived

```solidity
event OFTReceived(address from, uint256 amount, bytes data)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address owner_) public
```

### onOFTReceived

```solidity
function onOFTReceived(address from, uint256 amount, bytes data) external
```

### \_authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

\_Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
{upgradeToAndCall}.

Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.

````solidity
function _authorizeUpgrade(address) internal onlyOwner {}
```_

````
