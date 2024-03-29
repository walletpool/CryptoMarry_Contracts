// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";

import "./ILendingPoolV2.sol";
import "../UniswapV3/IWrappedNativeToken.sol";
import "./ILendingPoolAddressesProviderV2.sol";
import "../handlerBase.sol";

contract AaveV2Facet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);
    
    address public immutable wrappedNativeTokenAV2;
    address public immutable PROVIDERAV2;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _provider, address wrappedNativeToken_)
        ERC2771ContextUpgradeable(address(forwarder))
        {PROVIDERAV2 = _provider;
         wrappedNativeTokenAV2 = wrappedNativeToken_;}

    function executeAaveV2(
        uint256 _id
    ) external {
       address msgSender_ = _msgSender();   
        VoteProposalLib.enforceMarried();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceAcceptedStatus(_id);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        uint256 _amount = vt.voteProposalAttributes[_id].amount;

        //deposit 
        if (vt.voteProposalAttributes[_id].voteType == 600){
        vt.voteProposalAttributes[_id].voteStatus =600;
       
        address addr = vt.voteProposalAttributes[_id].tokenID;
        _amount = _getBalance(addr, _amount);
        _deposit(addr, _amount);
        }

        //deposit ETH
       else if (vt.voteProposalAttributes[_id].voteType == 601){
        vt.voteProposalAttributes[_id].voteStatus =601;
        _amount = _getBalance(NATIVE_TOKEN_ADDRESS, _amount);
        IWrappedNativeToken(wrappedNativeTokenAV2).deposit{value: _amount}();        
         _deposit(wrappedNativeTokenAV2, _amount);
        }

        //withdraw
       else if (vt.voteProposalAttributes[_id].voteType == 602){
        vt.voteProposalAttributes[_id].voteStatus = 602;
        address addr = vt.voteProposalAttributes[_id].tokenID;
        _withdraw(addr, _amount);
        }

        //withdrawETH
        else if (vt.voteProposalAttributes[_id].voteType == 603){
        vt.voteProposalAttributes[_id].voteStatus = 603;
        uint withdrawAmount = _withdraw(wrappedNativeTokenAV2, _amount); 
        IWrappedNativeToken(wrappedNativeTokenAV2).withdraw(withdrawAmount);   
        }
        else {revert COULD_NOT_PROCESS("Not AaveV2 Type");}
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function executeAaveV2BorrowRepay(
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


        //borrow
        if (vt.voteProposalAttributes[_id].voteType == 604){
        vt.voteProposalAttributes[_id].voteStatus = 604;
          address onBehalfOf = address(this);
          address addr = vt.voteProposalAttributes[_id].tokenID;
            _borrow(addr, _amount, rateMode, onBehalfOf);
        }
        //borrowETH
         else if (vt.voteProposalAttributes[_id].voteType == 605){
            vt.voteProposalAttributes[_id].voteStatus = 605;

        address onBehalfOf = address(this);
         _borrow(wrappedNativeTokenAV2, _amount, rateMode, onBehalfOf);
         IWrappedNativeToken(wrappedNativeTokenAV2).withdraw(_amount);
        }
        
        //repay
         else if (vt.voteProposalAttributes[_id].voteType == 606){
            vt.voteProposalAttributes[_id].voteStatus =606;

          address onBehalfOf = address(this);
          address addr = vt.voteProposalAttributes[_id].tokenID;
           _repay(addr, _amount, rateMode, onBehalfOf);
        }

        //repayETH
          else if (vt.voteProposalAttributes[_id].voteType == 607){
            vt.voteProposalAttributes[_id].voteStatus = 607;
            address onBehalfOf = address(this);
            IWrappedNativeToken(wrappedNativeTokenAV2).deposit{value: _amount}();
            _repay(wrappedNativeTokenAV2, _amount, rateMode, onBehalfOf);
        }
        
        else {revert COULD_NOT_PROCESS("Not AaveV2 Type");}
     
     emit VoteProposalLib.VoteStatus(
            _id,
            msgSender_,
            vt.voteProposalAttributes[_id].voteStatus,
            block.timestamp
        ); 

        VoteProposalLib.checkForwarder(); 
    }


      /* ========== INTERNAL FUNCTIONS ========== */

      function _deposit(address asset, uint256 amount) internal {
        (address pool, ) = _getLendingPoolAndAToken(asset);
        _tokenApprove(asset, pool, amount);
        try
            ILendingPoolV2(pool).deposit(
                asset,
                amount,
                address(this),
                0
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason); 
        } catch {
           revert COULD_NOT_PROCESS("deposit");
        }
        _tokenApproveZero(asset, pool);
    }

       function _withdraw(address asset, uint256 amount)
        internal
        returns (uint256 withdrawAmount)
    {
        (address pool, address aToken) = _getLendingPoolAndAToken(asset);
        amount = _getBalance(aToken, amount);

        try
            ILendingPoolV2(pool).withdraw(asset, amount, address(this))
        returns (uint256 ret) {
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
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDERAV2).getLendingPool();

        try
            ILendingPoolV2(pool).borrow(
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
        address pool =
            ILendingPoolAddressesProviderV2(PROVIDERAV2).getLendingPool();
        _tokenApprove(asset, pool, amount);

        try
            ILendingPoolV2(pool).repay(asset, amount, rateMode, onBehalfOf)
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("repay");
        }
        _tokenApproveZero(asset, pool);

        DataTypesV2.ReserveData memory reserve =
            ILendingPoolV2(pool).getReserveData(asset);
        remainDebt = DataTypesV2.InterestRateMode(rateMode) ==
            DataTypesV2.InterestRateMode.STABLE
            ? IERC20(reserve.stableDebtTokenAddress).balanceOf(onBehalfOf)
            : IERC20(reserve.variableDebtTokenAddress).balanceOf(onBehalfOf);
    }


     function _getLendingPoolAndAToken(address underlying)
        public
        view
        returns (address pool, address aToken)
    {
        pool = ILendingPoolAddressesProviderV2(PROVIDERAV2).getLendingPool();
        try ILendingPoolV2(pool).getReserveData(underlying) returns (
            DataTypesV2.ReserveData memory data
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

