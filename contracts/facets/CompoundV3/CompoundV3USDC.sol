// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "../UniswapV3/IWrappedNativeToken.sol";
import "./IComet.sol";
import "../handlerBase.sol";

contract CompoundV3FacetUSDC is ERC2771ContextUpgradeable, HandlerBase {
    error COULD_NOT_PROCESS(string);

    address public immutable cometAddress_USDC;
    address public immutable weth9Address_COMP;
    uint256 internal constant DAYS_PER_YEAR = 365;
    uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;
    uint256 internal constant SECONDS_PER_YEAR = SECONDS_PER_DAY * DAYS_PER_YEAR;
    uint256 internal constant MAX_UINT = type(uint256).max;

    uint256 public immutable BASE_MANTISSA_USDC;
    uint256 public immutable BASE_INDEX_SCALE_USDC;

    constructor(MinimalForwarderUpgradeable forwarder, address _cometAddress, address _weth9Address_COMP)
        ERC2771ContextUpgradeable(address(forwarder))
    {
        cometAddress_USDC = _cometAddress;
        weth9Address_COMP = _weth9Address_COMP;
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

        //supply ETH
        if (vt.voteProposalAttributes[_id].voteType == 800){
             vt.voteProposalAttributes[_id].voteStatus = 800;
             uint256 beforeTokenAmount = getcollateralBalanceOfUSDC(weth9Address_COMP);
             _amount = _getBalance(address(0), _amount);
             IWrappedNativeToken(weth9Address_COMP).deposit{value: _amount}();
             supplyToken(weth9Address_COMP, _amount);

              uint256 afterTokenAmount = getcollateralBalanceOfUSDC(weth9Address_COMP);
            if (afterTokenAmount == beforeTokenAmount)
                revert COULD_NOT_PROCESS("ErrorSupply");
        }

        //Supply non USDC Token 
        else if (vt.voteProposalAttributes[_id].voteType == 801) {
            vt.voteProposalAttributes[_id].voteStatus = 801;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            uint256 beforeTokenAmount = getcollateralBalanceOfUSDC(tokenIn);
             _amount = _getBalance(tokenIn, _amount);
            supplyToken(tokenIn, _amount);
             uint256 afterTokenAmount = getcollateralBalanceOfUSDC(tokenIn);
            if (afterTokenAmount == beforeTokenAmount)
                revert COULD_NOT_PROCESS("ErrorSupply");


        } //Supply USDC
        else if (vt.voteProposalAttributes[_id].voteType == 802) {
            vt.voteProposalAttributes[_id].voteStatus = 802;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            uint256 beforeTokenAmount = IERC20(tokenIn).balanceOf(address(this));
             _amount = _getBalance(tokenIn, _amount);
            supplyToken(tokenIn, _amount);
             uint256 afterTokenAmount = IERC20(tokenIn).balanceOf(address(this));
            if (afterTokenAmount == beforeTokenAmount)
                revert COULD_NOT_PROCESS("ErrorSupply");

       //withdraw ETH
        }else if (vt.voteProposalAttributes[_id].voteType == 803) {
            vt.voteProposalAttributes[_id].voteStatus = 803;
           withdrawToken(weth9Address_COMP, _amount);
           IWrappedNativeToken(weth9Address_COMP).withdraw(_amount);

        //withdraw Token
        } else if (vt.voteProposalAttributes[_id].voteType == 804) {
            vt.voteProposalAttributes[_id].voteStatus = 804;
            address tokenOut = vt.voteProposalAttributes[_id].tokenID;
           withdrawToken(tokenOut, _amount);

        //repayFullBorrow
        } else if (vt.voteProposalAttributes[_id].voteType == 805) {
            vt.voteProposalAttributes[_id].voteStatus = 805;
            address tokenIn = vt.voteProposalAttributes[_id].tokenID;
            uint256 debt = getBorrowBalanceOfUSDC();
            if (_amount < debt) {
                debt = _amount;
            }
             supplyToken(tokenIn, debt);
            uint256 afterDebt = getBorrowBalanceOfUSDC();
            if (afterDebt == debt)
                revert COULD_NOT_PROCESS("ErrorPayingDebt");
        }
        else {
            revert COULD_NOT_PROCESS("WrongType");
        }
        emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        );
        VoteProposalLib.checkForwarder();
    }

    function supplyToken(address tokenIn, uint256 _amount) internal {
         
            _tokenApprove(tokenIn, cometAddress_USDC, _amount);
            try Comet(cometAddress_USDC).supply(tokenIn, _amount) {
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("Error801");
            }
           
            _tokenApproveZero(tokenIn, cometAddress_USDC);

    }

    function withdrawToken(address tokenOut,uint256 _amount) internal {
         uint256 beforeTokenAmount = IERC20(tokenOut).balanceOf(address(this));
             try Comet(cometAddress_USDC).withdraw(tokenOut, _amount) {
            } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                revert COULD_NOT_PROCESS("ErrorWithdrawBorrow");
            }
            uint256 afterTokenAmount = IERC20(tokenOut).balanceOf(address(this));
            if (afterTokenAmount == beforeTokenAmount)
                revert COULD_NOT_PROCESS("ErrorWithdrawBorrow");
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
    function getBorrowableAmountUSDC() public view returns (int256) {
        Comet comet = Comet(cometAddress_USDC);
        uint8 numAssets = comet.numAssets();
        uint16 assetsIn = comet.userBasic(address(this)).assetsIn;
        uint64 si = comet.totalsBasic().baseSupplyIndex;
        uint64 bi = comet.totalsBasic().baseBorrowIndex;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        int256 liquidity = int256(
            (presentValueUSDC(comet.userBasic(address(this)).principal, si, bi) *
                int256(getCompoundPriceUSDC(baseTokenPriceFeed))) * int256(1e4)
        );

        for (uint8 i = 0; i < numAssets; i++) {
            if (isInAssetUSDC(assetsIn, i)) {
                CometStructs.AssetInfo memory asset = comet.getAssetInfo(i);
                uint256 newAmount = (uint256(
                    comet.userCollateral(address(this), asset.asset).balance
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
    error InvalidInt256();
    //Math 
     function signed256(uint256 n) internal pure returns (int256) {
        if (n > uint256(type(int256).max)) revert InvalidInt256();
        return int256(n);
    }

     /**
     * @dev The positive present supply balance if positive or the negative borrow balance if negative
     */
    function presentValueUSDC(int104 principalValue_, 
    uint64 baseSupplyIndex_,
    uint64 baseBorrowIndex_) internal view returns (int256) {
        if (principalValue_ >= 0) {
            return signed256(presentValueSupply(baseSupplyIndex_, uint104(principalValue_)));
        } else {
            return -signed256(presentValueBorrow(baseBorrowIndex_, uint104(-principalValue_)));
        }
    }

    /**
     * @dev The principal amount projected forward by the supply index
     */
    function presentValueSupply(uint64 baseSupplyIndex_, uint104 principalValue_) internal view returns (uint256) {
        return uint256(principalValue_) * baseSupplyIndex_ / uint64(BASE_INDEX_SCALE_USDC);
    }

    /**
     * @dev The principal amount projected forward by the borrow index
     */
    function presentValueBorrow(uint64 baseBorrowIndex_, uint104 principalValue_) internal view returns (uint256) {
        return uint256(principalValue_) * baseBorrowIndex_ / uint64(BASE_INDEX_SCALE_USDC);
    }



    // function presentValueUSDC(
    //     int104 principalValue_,
    //     uint64 baseSupplyIndex_,
    //     uint64 baseBorrowIndex_
    // ) internal view returns (int104) {
    //     if (principalValue_ >= 0) {
    //         return
    //             int104(
    //                 (uint104(principalValue_) * baseSupplyIndex_) /
    //                     uint64(BASE_INDEX_SCALE_USDC)
    //             );
    //     } else {
    //         return
    //             -int104(
    //                 (uint104(principalValue_) * baseBorrowIndex_) /
    //                     uint64(BASE_INDEX_SCALE_USDC)
    //             );
    //     }
    // }

    function isInAssetUSDC(uint16 assetsIn, uint8 assetOffset)
        internal
        pure
        returns (bool)
    {
        return (assetsIn & (uint16(1) << assetOffset) != 0);
    }
}
