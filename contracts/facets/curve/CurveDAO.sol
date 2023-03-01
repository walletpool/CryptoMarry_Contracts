// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../handlerBase.sol";
import "./IMinter.sol";
import "./ILiquidityGauge.sol";

contract CurveDAOFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);

    address public immutable CURVE_MINTER;
    address public immutable CRV_TOKEN;

    constructor(MinimalForwarderUpgradeable forwarder, address _CURVE_MINTER, address _CRV_TOKEN)
        ERC2771ContextUpgradeable(address(forwarder))
        {CURVE_MINTER = _CURVE_MINTER;
        CRV_TOKEN = _CRV_TOKEN;
        }

    function mint(address gaugeAddr) external payable returns (uint256) {
        IMinter minter = IMinter(CURVE_MINTER);
        address user = address(this);
        uint256 beforeCRVBalance = IERC20(CRV_TOKEN).balanceOf(user);
        if (!minter.allowed_to_mint_for(address(this), user)) { revert  COULD_NOT_PROCESS("not allowed to mint");}

        try minter.mint_for(gaugeAddr, user) {} catch Error(
            string memory reason
        ) {
            revert  COULD_NOT_PROCESS(reason);
        } catch {
            revert  COULD_NOT_PROCESS("mint");
        }
        uint256 afterCRVBalance = IERC20(CRV_TOKEN).balanceOf(user);
         VoteProposalLib.checkForwarder(); 
        return afterCRVBalance - beforeCRVBalance;
    }

    function mintMany(address[] calldata gaugeAddrs)
        external
        payable
        returns (uint256)
    {
        IMinter minter = IMinter(CURVE_MINTER);
          address user = address(this);
        uint256 beforeCRVBalance = IERC20(CRV_TOKEN).balanceOf(user);
        if (!minter.allowed_to_mint_for(address(this), user)) { revert  COULD_NOT_PROCESS("not allowed to mint");}

        for (uint256 i = 0; i < gaugeAddrs.length; i++) {
            try minter.mint_for(gaugeAddrs[i], user) {} catch Error(
                string memory reason
            ) {
                revert COULD_NOT_PROCESS(reason);
            } catch {
                 revert COULD_NOT_PROCESS(string(abi.encodePacked("Unspecified on ", _uint2String(i))));
            }
        }
         VoteProposalLib.checkForwarder(); 
        return IERC20(CRV_TOKEN).balanceOf(user) - beforeCRVBalance;
    }

     modifier checkValidity(uint24 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }

    function depositCurve(
        uint24 _id
    ) external payable checkValidity(_id){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 124) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =124;

         address gaugeAddress = vt.voteProposalAttributes[_id].tokenID;
        ILiquidityGauge gauge = ILiquidityGauge(gaugeAddress);
        address token = gauge.lp_token();
        address user = address(this);
        uint amount = vt.voteProposalAttributes[_id].amount;

         // if amount == type(uint256).max return balance of Proxy
       uint _value = _getBalance(token, amount);
        _tokenApprove(token, gaugeAddress, _value);

        try gauge.deposit(_value, user) {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert  COULD_NOT_PROCESS("deposit");
        }
        _tokenApproveZero(token, gaugeAddress);

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            124,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }


     function withdrawCurve(
        uint24 _id
    ) external payable checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 125) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =125;

         address gaugeAddress = vt.voteProposalAttributes[_id].tokenID;
        ILiquidityGauge gauge = ILiquidityGauge(gaugeAddress);
        address token = gauge.lp_token();
        uint amount = vt.voteProposalAttributes[_id].amount;

         // if amount == type(uint256).max return balance of Proxy
       uint _value = _getBalance(token, amount);

        try gauge.withdraw(_value) {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert  COULD_NOT_PROCESS("withdraw");
        }
     
        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            125,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
        return _value;
    }

}

