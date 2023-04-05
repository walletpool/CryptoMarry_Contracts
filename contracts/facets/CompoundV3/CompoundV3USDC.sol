// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "./IComet.sol";
import "../handlerBase.sol";

contract CompoundV3FacetUSDC is ERC2771ContextUpgradeable, HandlerBase {
    error COULD_NOT_PROCESS();

    address public immutable cometAddress_USDC;
    uint256 internal constant DAYS_PER_YEAR = 365;
    uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;
    uint256 internal constant SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR;
    uint256 internal constant MAX_UINT = type(uint256).max;

    uint256 public immutable BASE_MANTISSA_USDC;
    uint256 public immutable BASE_INDEX_SCALE_USDC;

    constructor(MinimalForwarderUpgradeable forwarder, address _cometAddress)
        ERC2771ContextUpgradeable(address(forwarder))
    {
        cometAddress_USDC = _cometAddress;
        BASE_MANTISSA_USDC = Comet(cometAddress_USDC).baseScale();
        BASE_INDEX_SCALE_USDC = Comet(cometAddress_USDC).baseIndexScale();
    }

    function executeSupplyCompoundV3USDC(uint256 _id) external {
        address msgSender_ = _msgSender();

        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        //supply
        if (vt.voteProposalAttributes[_id].voteType == 800) {
            vt.voteProposalAttributes[_id].voteStatus = 800;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            _amount = _getBalance(tokenIn, _amount);
            _tokenApprove(tokenIn, cometAddress_USDC, _amount);
            Comet(cometAddress_USDC).supply(tokenIn, _amount);
            _tokenApproveZero(tokenIn, cometAddress_USDC);
       //withdraw (or borrow)
        } else if (vt.voteProposalAttributes[_id].voteType == 801) {
            vt.voteProposalAttributes[_id].voteStatus = 801;
            address tokenOut = vt.voteProposalAttributes[_id].tokenID;
            Comet(cometAddress_USDC).withdraw(tokenOut, _amount);

        //repayFullBorrow
        } else if (vt.voteProposalAttributes[_id].voteType == 802) {
            vt.voteProposalAttributes[_id].voteStatus = 802;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            _amount = _getBalance(tokenIn, _amount);
            _tokenApprove(tokenIn, cometAddress_USDC, _amount);
            Comet(cometAddress_USDC).supply(tokenIn, _amount);
            _tokenApproveZero(tokenIn, cometAddress_USDC);
        }
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
    function getSupplyAprUSDC() public view returns (uint256) {
        Comet comet = Comet(cometAddress_USDC);
        uint256 utilization = comet.getUtilization();
        return comet.getSupplyRate(utilization) * SECONDS_PER_YEAR * 100;
    }

     
    /*
     * Get USD Balance
     */
    function getBalanceOfUSDC() public view returns (uint256) {
        Comet comet = Comet(cometAddress_USDC);
        return comet.balanceOf(address(this));
    }

    /*
     * Get Colleteral Balance
     */
    function getcollateralBalanceOfUSDC(address colleteralAsset) public view returns (uint256) {
        Comet comet = Comet(cometAddress_USDC);
        return comet.collateralBalanceOf(address(this),colleteralAsset);
    }

     /*
     * Get principal borrowed + interest 
     */
    function getBorrowBalanceOfUSDC() public view returns (uint256) {
        Comet comet = Comet(cometAddress_USDC);
        return comet.borrowBalanceOf(address(this));
    }

    /*
     * Get the current borrow APR in Compound III
     */
    function getBorrowAprUSDC() public view returns (uint256) {
        Comet comet = Comet(cometAddress_USDC);
        uint256 utilization = comet.getUtilization();
        return comet.getBorrowRate(utilization) * SECONDS_PER_YEAR * 100;
    }

    /*
     * Get the current reward for supplying APR in Compound III
     * @param rewardTokenPriceFeed The address of the reward token (e.g. COMP) price feed
     * @return The reward APR in USD as a decimal scaled up by 1e18
     */
    function getRewardAprForSupplyBaseUSDC(address rewardTokenPriceFeed)
        public
        view
        returns (uint256)
    {
        Comet comet = Comet(cometAddress_USDC);
        uint256 rewardTokenPriceInUsd = getCompoundPriceUSDC(rewardTokenPriceFeed);
        uint256 usdcPriceInUsd = getCompoundPriceUSDC(comet.baseTokenPriceFeed());
        uint256 usdcTotalSupply = comet.totalSupply();
        uint256 baseTrackingSupplySpeed = comet.baseTrackingSupplySpeed();
        uint256 rewardToSuppliersPerDay = baseTrackingSupplySpeed *
            SECONDS_PER_DAY *
            (BASE_INDEX_SCALE_USDC / BASE_MANTISSA_USDC);
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
    function getRewardAprForBorrowBaseUSDC(address rewardTokenPriceFeed)
        public
        view
        returns (uint256)
    {
        Comet comet = Comet(cometAddress_USDC);
        uint256 rewardTokenPriceInUsd = getCompoundPriceUSDC(rewardTokenPriceFeed);
        uint256 usdcPriceInUsd = getCompoundPriceUSDC(comet.baseTokenPriceFeed());
        uint256 usdcTotalBorrow = comet.totalBorrow();
        uint256 baseTrackingBorrowSpeed = comet.baseTrackingBorrowSpeed();
        uint256 rewardToSuppliersPerDay = baseTrackingBorrowSpeed *
            SECONDS_PER_DAY *
            (BASE_INDEX_SCALE_USDC / BASE_MANTISSA_USDC);
        uint256 borrowBaseRewardApr = ((rewardTokenPriceInUsd *
            rewardToSuppliersPerDay) / (usdcTotalBorrow * usdcPriceInUsd)) *
            DAYS_PER_YEAR;
        return borrowBaseRewardApr;
    }

    /*
     * Get the amount of base asset that can be borrowed by an account
     *     scaled up by 10 ^ 8
     */
    function getBorrowableAmountUSDC(address account) public view returns (int256) {
        Comet comet = Comet(cometAddress_USDC);
        uint8 numAssets = comet.numAssets();
        uint16 assetsIn = comet.userBasic(account).assetsIn;
        uint64 si = comet.totalsBasic().baseSupplyIndex;
        uint64 bi = comet.totalsBasic().baseBorrowIndex;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        int256 liquidity = int256(
            (presentValueUSDC(comet.userBasic(account).principal, si, bi) *
                int256(getCompoundPriceUSDC(baseTokenPriceFeed))) / int256(1e8)
        );

        for (uint8 i = 0; i < numAssets; i++) {
            if (isInAssetUSDC(assetsIn, i)) {
                CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
                uint256 newAmount = (uint256(
                    comet.userCollateral(account, asset.asset).balance
                ) * getCompoundPriceUSDC(asset.priceFeed)) / 1e8;
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
    function getPriceFeedAddressUSDC(address asset) public view returns (address) {
        Comet comet = Comet(cometAddress_USDC);
        return comet.getAssetInfoByAddress(asset).priceFeed;
    }

    /*
     * Get the price feed address for the base token
     */
    function getBaseTokenPriceFeedUSDC() public view returns (address) {
        Comet comet = Comet(cometAddress_USDC);
        return comet.baseTokenPriceFeed();
    }

    /*
     * Get the current price of an asset from the protocol's persepctive
     */
    function getCompoundPriceUSDC(address singleAssetPriceFeed)
        public
        view
        returns (uint256)
    {
        Comet comet = Comet(cometAddress_USDC);
        return comet.getPrice(singleAssetPriceFeed);
    }

    /*
     * Gets the amount of reward tokens due to this contract address
     */
    function getRewardsOwedUSDC(address rewardsContract) public returns (uint256) {
        return
            CometRewards(rewardsContract)
                .getRewardOwed(cometAddress_USDC, address(this))
                .owed;
    }

    /*
     * Claims the reward tokens due to this contract address
     */
    function claimCometRewardsUSDC(address rewardsContract) public {
        CometRewards(rewardsContract).claim(cometAddress_USDC, address(this), true);
    }

    /*
     * Gets the Compound III TVL in USD scaled up by 1e8
     */
    function getTvlUSDC() public view returns (uint256) {
        Comet comet = Comet(cometAddress_USDC);

        uint256 baseScale = 10**ERC20Comet(cometAddress_USDC).decimals();
        uint256 basePrice = getCompoundPriceUSDC(comet.baseTokenPriceFeed());
        uint256 totalSupplyBase = comet.totalSupply();

        uint256 tvlUsd = (totalSupplyBase * basePrice) / baseScale;

        uint8 numAssets = comet.numAssets();
        for (uint8 i = 0; i < numAssets; i++) {
            CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
            CometStructs.TotalsCollateral memory tc = comet.totalsCollateral(
                asset.asset
            );
            uint256 price = getCompoundPriceUSDC(asset.priceFeed);
            uint256 scale = 10**ERC20Comet(asset.asset).decimals();

            tvlUsd += (tc.totalSupplyAsset * price) / scale;
        }

        return tvlUsd;
    }


    function presentValueUSDC(
        int104 principalValue_,
        uint64 baseSupplyIndex_,
        uint64 baseBorrowIndex_
    ) internal view returns (int104) {
        if (principalValue_ >= 0) {
            return
                int104(
                    (uint104(principalValue_) * baseSupplyIndex_) /
                        uint64(BASE_INDEX_SCALE_USDC)
                );
        } else {
            return
                -int104(
                    (uint104(principalValue_) * baseBorrowIndex_) /
                        uint64(BASE_INDEX_SCALE_USDC)
                );
        }
    }

    function isInAssetUSDC(uint16 assetsIn, uint8 assetOffset)
        internal
        pure
        returns (bool)
    {
        return (assetsIn & (uint16(1) << assetOffset) != 0);
    }
}
