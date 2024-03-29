// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./IPool.sol";
import "../UniswapV3/IWrappedNativeToken.sol";
import "../handlerBase.sol";

contract AaveV3Facet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable PROVIDERAV3;
    address public immutable wrappedNativeTokenAV3;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _provider, address wrappedNativeToken_)
        ERC2771ContextUpgradeable(address(forwarder))
        {PROVIDERAV3 = _provider;
        wrappedNativeTokenAV3 = wrappedNativeToken_;}

    function executeAaveV3(
        uint256 _id
    ) external {
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        if (vt.voteProposalAttributes[_id].voteType == 220){
        vt.voteProposalAttributes[_id].voteStatus =220;
        address addr = vt.voteProposalAttributes[_id].tokenID;
        _amount = _getBalance(addr, _amount);
        _supply(addr, _amount);
        }

       else if (vt.voteProposalAttributes[_id].voteType == 221){
        vt.voteProposalAttributes[_id].voteStatus =221;
        _amount = _getBalance(NATIVE_TOKEN_ADDRESS, _amount);

        IWrappedNativeToken(wrappedNativeTokenAV3).deposit{value: _amount}();        
         _supply(wrappedNativeTokenAV3, _amount);

        }

       else if (vt.voteProposalAttributes[_id].voteType == 222){
        vt.voteProposalAttributes[_id].voteStatus = 222;
        address addr = vt.voteProposalAttributes[_id].tokenID;
        _withdraw(addr, _amount);
        }

        else if (vt.voteProposalAttributes[_id].voteType == 223){
        vt.voteProposalAttributes[_id].voteStatus = 223;
        uint withdrawAmount = _withdraw(wrappedNativeTokenAV3, _amount); 
        IWrappedNativeToken(wrappedNativeTokenAV3).withdraw(withdrawAmount);   
        }
        
        else {revert COULD_NOT_PROCESS("Not AaveV3 Type");}
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function executeAaveV3BorrowRepay(
        uint256 _id,
         uint256 rateMode
    ) external {
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        
        if (vt.voteProposalAttributes[_id].voteType == 224){
        vt.voteProposalAttributes[_id].voteStatus = 224;

          address onBehalfOf = address(this);
          address addr = vt.voteProposalAttributes[_id].tokenID;
            _borrow(addr, _amount, rateMode, onBehalfOf);
        }

         else if (vt.voteProposalAttributes[_id].voteType == 225){
            vt.voteProposalAttributes[_id].voteStatus =225;

          address onBehalfOf = address(this);
         _borrow(wrappedNativeTokenAV3, _amount, rateMode, onBehalfOf);
         IWrappedNativeToken(wrappedNativeTokenAV3).withdraw(_amount);
        }

         else if (vt.voteProposalAttributes[_id].voteType == 226){
            vt.voteProposalAttributes[_id].voteStatus =226;

          address onBehalfOf = address(this);
          address addr = vt.voteProposalAttributes[_id].tokenID;
           _repay(addr, _amount, rateMode, onBehalfOf);
        }

          else if (vt.voteProposalAttributes[_id].voteType == 227){
            vt.voteProposalAttributes[_id].voteStatus =227;
            address onBehalfOf = address(this);
            IWrappedNativeToken(wrappedNativeTokenAV3).deposit{value: _amount}();
            _repay(wrappedNativeTokenAV3, _amount, rateMode, onBehalfOf);
        }
        
        else {revert COULD_NOT_PROCESS("Not AaveV3 Borrow Type");}
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

      /* ========== INTERNAL FUNCTIONS ========== */

    function _supply(address asset, uint256 amount) internal {
        
        (address pool, ) = _getPoolAndAToken(asset);
        _tokenApprove(asset, pool, amount);
        try
            IPool(pool).supply(asset, amount, address(this), 0)
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason); 
        } catch {
            revert COULD_NOT_PROCESS("supply");
        }
        _tokenApproveZero(asset, pool);
    }

     function _withdraw(address asset, uint256 amount)
        internal
        returns (uint256 withdrawAmount)
    {
        (address pool, address aToken) = _getPoolAndAToken(asset);
        amount = _getBalance(aToken, amount);

        try IPool(pool).withdraw(asset, amount, address(this)) returns (
            uint256 ret
        ) {
            withdrawAmount = ret;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason); 
        } catch {
            revert COULD_NOT_PROCESS("withdraw");
        }
    }

    function _borrow(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) internal {

        (address pool, ) = _getPoolAndAToken(asset);
       // address pool = IPoolAddressesProvider(PROVIDERAV3).getPool();

        try
            IPool(pool).borrow(
                asset,
                amount,
                rateMode,
                0,
                onBehalfOf
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason); 
        } catch {
            revert COULD_NOT_PROCESS("withdraw");
        }
    }
    function _repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) internal returns (uint256 remainDebt) {
        (address pool, ) = _getPoolAndAToken(asset);
       // address pool = IPoolAddressesProvider(PROVIDERAV3).getPool();
        _tokenApprove(asset, pool, amount);

        try
            IPool(pool).repay(asset, amount, rateMode, onBehalfOf)
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason); 
        } catch {
            revert COULD_NOT_PROCESS("repay");
        }

        _tokenApproveZero(asset, pool);

        DataTypes.ReserveData memory reserve =
            IPool(pool).getReserveData(asset);
        remainDebt = DataTypes.InterestRateMode(rateMode) ==
            DataTypes.InterestRateMode.STABLE
            ? IERC20(reserve.stableDebtTokenAddress).balanceOf(onBehalfOf)
            : IERC20(reserve.variableDebtTokenAddress).balanceOf(onBehalfOf);
    }

    function _getPoolAndAToken(address underlying)
        public
        view
        returns (address pool, address aToken)
    {
        pool = IPoolAddressesProvider(PROVIDERAV3).getPool();
        try IPool(pool).getReserveData(underlying) returns (
            DataTypes.ReserveData memory data
        ) {
            aToken = data.aTokenAddress;
            if (aToken == address(0)) {
                revert COULD_NOT_PROCESS("aToken should not be zero"); 
            }
        } catch Error(string memory reason) {
                revert COULD_NOT_PROCESS(reason); 
        } catch {
            revert COULD_NOT_PROCESS("General");
        }
    }
}

