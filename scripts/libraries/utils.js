const { BN } = require('@openzeppelin/test-helpers');
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const fetch = require('node-fetch');
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));
const web3 = require('web3');


const { expect } = require('chai');

function profileGas(receipt) {
  receipt.logs.forEach(element => {
    if (element.event === 'DeltaGas')
      console.log(
        web3.utils.hexToAscii(element.args.tag) +
          ': ' +
          element.args.gas.toString()
      );
  });
}

async function evmSnapshot() {
  return await network.provider.send('evm_snapshot', []);
}

async function evmRevert(id = 1) {
  await network.provider.send('evm_revert', [id]);
}

async function evmRevertAndSnapshot(id = 1, host = 'http://localhost:8545') {
  // ganache snapshot id must >= 1
  if (id < 1) {
    console.log(`evmRevertAndSnapshot failed: unacceptable snapshot id`);
    return -1;
  }
  const revertSuccess = await evmRevert(id, host);
  let new_id = -1;
  if (revertSuccess) {
    new_id = await evmSnapshot(host);
  }
  if (new_id == -1) console.log(`evmRevertAndSnapshot failed`);
  return new_id;
}

function mulPercent(num, percentage) {
  return new BN(num).mul(new BN(percentage)).div(new BN(100));
}

function cUnit(amount) {
  return new BN(amount).mul(new BN('100000000'));
}

function getHandlerReturn(receipt, dataTypes) {
  var handlerResult;
  receipt.receipt.rawLogs.forEach(element => {
    if (element.topics[0] === RecordHandlerResultSig) {
      const bytesData = web3.eth.abi.decodeParameters(
        ['bytes'],
        element.data
      )[0];
      handlerResult = web3.eth.abi.decodeParameters(dataTypes, bytesData);
    }
  });
  return handlerResult;
}

// Only works when one function name matches
function getAbi(artifact, name) {
  var abi;
  artifact.abi.forEach((element, i) => {
    if (element.name === name) {
      abi = element;
    }
  });
  return abi;
}

function getCallData(artifact, name, params) {
  return web3.eth.abi.encodeFunctionCall(getAbi(artifact, name), params);
}

function decodeInputData(artifact, name, params) {
  return web3.eth.abi.decodeParameters(getAbi(artifact, name).inputs, params);
}

function decodeOutputData(artifact, name, params) {
  return web3.eth.abi.decodeParameters(getAbi(artifact, name).outputs, params);
}

function getFuncSig(artifact, name) {
  return web3.eth.abi.encodeFunctionSignature(getAbi(artifact, name));
}

// Note that should not be used for a contract which is proxy or has fallback function
async function hasFuncSig(contractAddress, signature) {
  const code = await web3.eth.getCode(contractAddress);
  return code.indexOf(signature.slice(2, signature.length)) > 0;
}

function expectEqWithinBps(actual, expected, bps = 1) {
  const base = new BN('10000');
  const upper = new BN(expected).mul(base.add(new BN(bps))).div(base);
  const lower = new BN(expected).mul(base.sub(new BN(bps))).div(base);
  expect(actual).to.be.bignumber.lte(upper);
  expect(actual).to.be.bignumber.gte(lower);
}

async function nativeTokenProvider() {
  // Impersonate wrapped native token
  await network.provider.send('hardhat_impersonateAccount', [
    WRAPPED_NATIVE_TOKEN,
  ]);

  return WRAPPED_NATIVE_TOKEN;
}

async function getTokenProvider(
  token0 = USDC_TOKEN,
  token1 = WETH_TOKEN,
  fee = 500
) {
  const chainId = network.config.chainId;
  if (chainId == 1 || chainId == 10 || chainId == 42161) {
    let provider = await tokenProviderUniV3(token0, token1, fee);
    return provider == ZERO_ADDRESS
      ? await tokenProviderUniV3(token0, token1, 3000)
      : provider;
  } else if (chainId == 137) {
    return await tokenProviderQuick(token0, token1);
  } else if (chainId == 43114) {
    return await tokenProviderTraderJoe(token0, WAVAX_TOKEN);
  }
}

async function tokenProviderUniV3(
  token0 = USDC_TOKEN,
  token1 = WETH_TOKEN,
  fee = 500 // 0.05%
) {
  if (token0 === WETH_TOKEN) {
    token1 = USDC_TOKEN;
  }

  const uniswapV3Factory = await ethers.getContractAt(
    ['function getPool(address,address,uint24) view returns (address)'],
    UNISWAPV3_FACTORY
  );
  const pool = await uniswapV3Factory.getPool(token0, token1, fee);
  impersonateAndInjectEther(pool);

  return pool;
}

async function tokenProviderTraderJoe(
  token0 = USDC_TOKEN,
  token1 = WAVAX_TOKEN,
  factoryAddress = JOE_FACTORY
) {
  if (token0 === WAVAX_TOKEN) {
    token1 = USDC_TOKEN;
  }
  return _tokenProviderUniLike(token0, token1, factoryAddress);
}

async function tokenProviderQuick(
  token0 = USDC_TOKEN,
  token1 = WETH_TOKEN,
  factoryAddress = QUICKSWAP_FACTORY
) {
  if (token0 === WETH_TOKEN) {
    token1 = USDC_TOKEN;
  }
  return _tokenProviderUniLike(token0, token1, factoryAddress);
}

async function tokenProviderUniV2(
  token0 = USDC_TOKEN,
  token1 = WETH_TOKEN,
  factoryAddress = UNISWAPV2_FACTORY
) {
  if (token0 === WETH_TOKEN) {
    token1 = USDC_TOKEN;
  }
  return _tokenProviderUniLike(token0, token1, factoryAddress);
}

async function tokenProviderSushi(
  token0 = USDC_TOKEN,
  token1 = WETH_TOKEN,
  factoryAddress = SUSHISWAP_FACTORY
) {
  if (token0 === WETH_TOKEN) {
    token1 = USDC_TOKEN;
  }
  return _tokenProviderUniLike(token0, token1, factoryAddress);
}

async function _tokenProviderUniLike(token0, token1, factoryAddress) {
  const IUniswapV2Factory = artifacts.require('IUniswapV2Factory');
  const factory = await IUniswapV2Factory.at(factoryAddress);
  const pair = await factory.getPair.call(token0, token1);
  impersonateAndInjectEther(pair);

  return pair;
}

async function tokenProviderCurveGauge(lpToken) {
  // Get curve registry
  const addressProvider = await ethers.getContractAt(
    ['function get_registry() view returns (address)'],
    CURVE_ADDRESS_PROVIDER
  );
  const registryAddress = await addressProvider.get_registry();

  // Get curve gauge
  const registry = await ethers.getContractAt(
    [
      'function get_pool_from_lp_token(address) view returns (address)',
      'function get_gauges(address) view returns (address[10], int128[10])',
    ],
    registryAddress
  );
  const poolAddress = await registry.get_pool_from_lp_token(lpToken);
  const gauges = await registry.get_gauges(poolAddress);

  // Return non-zero gauge
  let gauge;
  for (let element of gauges[0]) {
    if (element != ZERO_ADDRESS) {
      gauge = element;
      break;
    }
  }
  impersonateAndInjectEther(gauge);

  return gauge;
}

async function tokenProviderYearn(token) {
  // Get yearn vault
  const controller = await ethers.getContractAt(
    ['function vaults(address) view returns (address)'],
    YEARN_CONTROLLER
  );
  const vault = await controller.vaults(token);
  impersonateAndInjectEther(vault);

  return vault;
}

async function impersonateAndInjectEther(address) {
  // Impersonate pair
  await network.provider.send('hardhat_impersonateAccount', [address]);

  // Inject 1 ether
  await network.provider.send('hardhat_setBalance', [
    address,
    '0xde0b6b3a7640000',
  ]);
}

async function callExternalApi(
  request,
  method = 'get',
  body = '',
  retryTimes = 5
) {
  let resp;
  let tryTimes = retryTimes;
  while (tryTimes > 0) {
    tryTimes--;
    if (method === 'get') {
      resp = await fetch(request);
    } else {
      resp = await fetch(request, {
        method: method,
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (resp.ok === true) {
      return resp;
    }
    await sleep(500); // sleep 500ms.
  }
  return resp; // return error resp from external api to caller.
}

function mwei(num) {
  return new BN(ethers.utils.parseUnits(num, 6).toString());
}

async function checkCacheClean(proxyAddr) {
  expect(await web3.eth.getStorageAt(proxyAddr, STORAGE_KEY_MSG_SENDER)).to.be
    .zero;
  expect(await web3.eth.getStorageAt(proxyAddr, STORAGE_KEY_CUBE_COUNTER)).to.be
    .zero;
  expect(await web3.eth.getStorageAt(proxyAddr, STORAGE_KEY_FEE_RATE)).to.be
    .zero;
  expect(await web3.eth.getStorageAt(proxyAddr, STORAGE_KEY_FEE_COLLECTOR)).to
    .be.zero;
}

module.exports = {
  profileGas,
  evmSnapshot,
  evmRevert,
  evmRevertAndSnapshot,
  mulPercent,
  cUnit,
  getHandlerReturn,
  getAbi,
  getCallData,
  decodeInputData,
  decodeOutputData,
  getFuncSig,
  hasFuncSig,
  expectEqWithinBps,
  nativeTokenProvider,
  getTokenProvider,
  tokenProviderUniV3,
  tokenProviderTraderJoe,
  tokenProviderUniV2,
  tokenProviderSushi,
  tokenProviderCurveGauge,
  tokenProviderYearn,
  impersonateAndInjectEther,
  callExternalApi,
  mwei,
  checkCacheClean,
};