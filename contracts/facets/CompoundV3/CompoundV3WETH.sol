// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./IComet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../handlerBase.sol";

contract CompoundV3FacetWETH is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS();

    address public immutable cometAddressWETH;
    uint256 internal constant DAYS_PER_YEAR = 365;
    uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;
    uint256 internal constant SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR;
    uint256 internal constant MAX_UINT = type(uint256).max;

    uint256 public immutable BASE_MANTISSA_WETH;
    uint256 public immutable BASE_INDEX_SCALE_WETH;

    constructor(MinimalForwarderUpgradeable forwarder, address _cometAddress)
        ERC2771ContextUpgradeable(address(forwarder))
    {
        cometAddressWETH = _cometAddress;
        BASE_MANTISSA_WETH = Comet(cometAddressWETH).baseScale();
        BASE_INDEX_SCALE_WETH = Comet(cometAddressWETH).baseIndexScale();
    }

    function executeSupplyCompoundV3WETH(uint256 _id) external {
        address msgSender_ = _msgSender();

        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        //supply
        if (vt.voteProposalAttributes[_id].voteType == 803) {
            vt.voteProposalAttributes[_id].voteStatus = 803;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            _amount = _getBalance(tokenIn, _amount);
            _tokenApprove(tokenIn, cometAddressWETH, _amount);
            Comet(cometAddressWETH).supply(tokenIn, _amount);
            _tokenApproveZero(tokenIn, cometAddressWETH);
       //withdraw (or borrow)
        } else if (vt.voteProposalAttributes[_id].voteType == 804) {
            vt.voteProposalAttributes[_id].voteStatus = 804;
            address tokenOut = vt.voteProposalAttributes[_id].tokenID;
            Comet(cometAddressWETH).withdraw(tokenOut, _amount);

        //repayFullBorrow
        } else if (vt.voteProposalAttributes[_id].voteType == 805) {
            vt.voteProposalAttributes[_id].voteStatus = 805;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            _amount = _getBalance(tokenIn, MAX_UINT);
            _tokenApprove(tokenIn, cometAddressWETH, _amount);
            Comet(cometAddressWETH).supply(tokenIn, _amount);
            _tokenApproveZero(tokenIn, cometAddressWETH);
        }
        // Redeeming cToken for corresponding ERC20 token.
        else {
            revert COULD_NOT_PROCESS();
        }
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    /*
     * Get the current supply APR in Compound III
     */
    function getSupplyAprWETH() public view returns (uint256) {
        Comet comet = Comet(cometAddressWETH);
        uint256 utilization = comet.getUtilization();
        return comet.getSupplyRate(utilization) * SECONDS_PER_YEAR * 100;
    }

    /*
     * Get the current borrow APR in Compound III
     */
    function getBorrowAprWETH() public view returns (uint256) {
        Comet comet = Comet(cometAddressWETH);
        uint256 utilization = comet.getUtilization();
        return comet.getBorrowRate(utilization) * SECONDS_PER_YEAR * 100;
    }

    /*
     * Get the current reward for supplying APR in Compound III
     * @param rewardTokenPriceFeed The address of the reward token (e.g. COMP) price feed
     * @return The reward APR in USD as a decimal scaled up by 1e18
     */
    function getRewardAprForSupplyBaseWETH(address rewardTokenPriceFeed)
        public
        view
        returns (uint256)
    {
        Comet comet = Comet(cometAddressWETH);
        uint256 rewardTokenPriceInUsd = getCompoundPriceWETH(rewardTokenPriceFeed);
        uint256 usdcPriceInUsd = getCompoundPriceWETH(comet.baseTokenPriceFeed());
        uint256 usdcTotalSupply = comet.totalSupply();
        uint256 baseTrackingSupplySpeed = comet.baseTrackingSupplySpeed();
        uint256 rewardToSuppliersPerDay = baseTrackingSupplySpeed *
            SECONDS_PER_DAY *
            (BASE_INDEX_SCALE_WETH / BASE_MANTISSA_WETH);
        uint256 supplyBaseRewardApr = ((rewardTokenPriceInUsd *
            rewardToSuppliersPerDay) / (usdcTotalSupply * usdcPriceInUsd)) *
            DAYS_PER_YEAR;
        return supplyBaseRewardApr;
    }

    /*
     * Get the current reward for borrowing APR in Compound III
     * @param rewardTokenPriceFeed The address of the reward token (e.g. COMP) price feed
     * @return The reward APR in USD as a decimal scaled up by 1e18
     */
    function getRewardAprForBorrowBaseWETH(address rewardTokenPriceFeed)
        public
        view
        returns (uint256)
    {
        Comet comet = Comet(cometAddressWETH);
        uint256 rewardTokenPriceInUsd = getCompoundPriceWETH(rewardTokenPriceFeed);
        uint256 usdcPriceInUsd = getCompoundPriceWETH(comet.baseTokenPriceFeed());
        uint256 usdcTotalBorrow = comet.totalBorrow();
        uint256 baseTrackingBorrowSpeed = comet.baseTrackingBorrowSpeed();
        uint256 rewardToSuppliersPerDay = baseTrackingBorrowSpeed *
            SECONDS_PER_DAY *
            (BASE_INDEX_SCALE_WETH / BASE_MANTISSA_WETH);
        uint256 borrowBaseRewardApr = ((rewardTokenPriceInUsd *
            rewardToSuppliersPerDay) / (usdcTotalBorrow * usdcPriceInUsd)) *
            DAYS_PER_YEAR;
        return borrowBaseRewardApr;
    }

    /*
     * Get the amount of base asset that can be borrowed by an account
     *     scaled up by 10 ^ 8
     */
    function getBorrowableAmountWETH(address account) public view returns (int256) {
        Comet comet = Comet(cometAddressWETH);
        uint8 numAssets = comet.numAssets();
        uint16 assetsIn = comet.userBasic(account).assetsIn;
        uint64 si = comet.totalsBasic().baseSupplyIndex;
        uint64 bi = comet.totalsBasic().baseBorrowIndex;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        int256 liquidity = int256(
            (presentValueWETH(comet.userBasic(account).principal, si, bi) *
                int256(getCompoundPriceWETH(baseTokenPriceFeed))) / int256(1e8)
        );

        for (uint8 i = 0; i < numAssets; i++) {
            if (isInAssetWETH(assetsIn, i)) {
                CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
                uint256 newAmount = (uint256(
                    comet.userCollateral(account, asset.asset).balance
                ) * getCompoundPriceWETH(asset.priceFeed)) / 1e8;
                liquidity += int256(
                    (newAmount * asset.borrowCollateralFactor) / 1e18
                );
            }
        }

        return liquidity;
    }

    /*
     * Get the price feed address for an asset
     */
    function getPriceFeedAddressWETH(address asset) public view returns (address) {
        Comet comet = Comet(cometAddressWETH);
        return comet.getAssetInfoByAddress(asset).priceFeed;
    }

    /*
     * Get the price feed address for the base token
     */
    function getBaseTokenPriceFeedWETH() public view returns (address) {
        Comet comet = Comet(cometAddressWETH);
        return comet.baseTokenPriceFeed();
    }

    /*
     * Get the current price of an asset from the protocol's persepctive
     */
    function getCompoundPriceWETH(address singleAssetPriceFeed)
        public
        view
        returns (uint256)
    {
        Comet comet = Comet(cometAddressWETH);
        return comet.getPrice(singleAssetPriceFeed);
    }

    /*
     * Gets the amount of reward tokens due to this contract address
     */
    function getRewardsOwedWETH(address rewardsContract) public returns (uint256) {
        return
            CometRewards(rewardsContract)
                .getRewardOwed(cometAddressWETH, address(this))
                .owed;
    }

    /*
     * Claims the reward tokens due to this contract address
     */
    function claimCometRewardsWETH(address rewardsContract) public {
        CometRewards(rewardsContract).claim(cometAddressWETH, address(this), true);
    }

    /*
     * Gets the Compound III TVL in USD scaled up by 1e8
     */
    function getTvlWETH() public view returns (uint256) {
        Comet comet = Comet(cometAddressWETH);

        uint256 baseScale = 10**ERC20Comet(cometAddressWETH).decimals();
        uint256 basePrice = getCompoundPriceWETH(comet.baseTokenPriceFeed());
        uint256 totalSupplyBase = comet.totalSupply();

        uint256 tvlUsd = (totalSupplyBase * basePrice) / baseScale;

        uint8 numAssets = comet.numAssets();
        for (uint8 i = 0; i < numAssets; i++) {
            CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
            CometStructs.TotalsCollateral memory tc = comet.totalsCollateral(
                asset.asset
            );
            uint256 price = getCompoundPriceWETH(asset.priceFeed);
            uint256 scale = 10**ERC20Comet(asset.asset).decimals();

            tvlUsd += (tc.totalSupplyAsset * price) / scale;
        }

        return tvlUsd;
    }


    function presentValueWETH(
        int104 principalValue_,
        uint64 baseSupplyIndex_,
        uint64 baseBorrowIndex_
    ) internal view returns (int104) {
        if (principalValue_ >= 0) {
            return
                int104(
                    (uint104(principalValue_) * baseSupplyIndex_) /
                        uint64(BASE_INDEX_SCALE_WETH)
                );
        } else {
            return
                -int104(
                    (uint104(principalValue_) * baseBorrowIndex_) /
                        uint64(BASE_INDEX_SCALE_WETH)
                );
        }
    }

    function isInAssetWETH(uint16 assetsIn, uint8 assetOffset)
        internal
        pure
        returns (bool)
    {
        return (assetsIn & (uint16(1) << assetOffset) != 0);
    }
}
