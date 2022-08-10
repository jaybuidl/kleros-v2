# Console Cookbook

## Staking

```typescript
const juror1 = new ethers.Wallet(process.env.PRIVATE_KEY_JUROR1, ethers.provider);
pnk = await ethers.getContract("PNK");
core = await ethers.getContract("KlerosCore");

// approve 20k PNK
await pnk.connect(juror1).approve(core.address, ethers.BigNumber.from(10).pow(18).mul(20000));

// stake 8k PNK
await core
  .connect(juror1)
  .setStake(0, ethers.BigNumber.from(10).pow(18).mul(8000), { gasLimit: 10000000, gasPrice: 5000000000 })(
    // check
    await core.getJurorBalance(juror1.address, 0)
  )
  .forEach((r) => console.log(ethers.utils.formatUnits(r, "ether")));
```
