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
import "./ICurveHandler.sol";
import "./IMinter.sol";
import "./ILiquidityGauge.sol";

contract CurveFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);

    address public immutable CURVE_MINTER;
    address public immutable CRV_TOKEN;

    bytes32 constant YT_STORAGE_POSITION =
        keccak256("waverimplementation.YearnApp.VoteTrackingStorage"); //Storing position of the variables

    constructor(MinimalForwarderUpgradeable forwarder, address _CURVE_MINTER, address _CRV_TOKEN)
        ERC2771ContextUpgradeable(address(forwarder))
        {
        CURVE_MINTER = _CURVE_MINTER;
        CRV_TOKEN = _CRV_TOKEN;
        }

    struct YearnStorage {
        mapping (uint256 => address []) addresses;
        mapping (uint256 => uint256 []) amounts;
    }

    function YearnStorageTracking()
        internal
        pure
        returns (YearnStorage storage yt)
    {
        bytes32 position = YT_STORAGE_POSITION;
        assembly {
            yt.slot := position
        }
    }
    
    /**
     * @notice Through this method proposals for voting is created. 
     * @dev All params are required. tokenID for the native currency is 0x0 address. To create proposals it is necessary to 
     have LOVE tokens as it will be used as backing of the proposal. 
     * @param _message String text on details of the proposal. 
     * @param _votetype Type of the proposal as it was listed in enum above. 
     * @param _voteends Timestamp on when the voting ends
     * @param _numTokens Number of LOVE tokens that is used to back this proposal. 
     * @param _pool Address of Curve Pool
     * @param handler Address of handler
     * @param minPoolAmount The amounts of minPool 
     */

    function createProposalLiquidity(
        bytes calldata _message,
        uint16 _votetype,
        uint256 _voteends,
        uint256 _numTokens,
        uint256 minPoolAmount,
        address payable _pool,
        address handler,
        address [] memory _tokenIDs,
        uint256 [] memory _amounts,
        uint8 _familyDao
    ) external {
        address msgSender_ = _msgSender();
        VoteProposalLib.enforceUserHasAccess(msgSender_);
        VoteProposalLib.enforceMarried();
        require(bytes(_message).length < 192);
        VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        YearnStorage storage yt = YearnStorageTracking();

        require(_familyDao<2);
        if (_voteends < block.timestamp + vt.setDeadline) {_voteends = block.timestamp + vt.setDeadline; } //Checking for too short notice
        if (_familyDao == 0) {_numTokens=1;}
        vt.voteProposalAttributes[vt.voteid] = VoteProposalLib.VoteProposal({
            id: vt.voteid,
            proposer: msgSender_,
            voteType: _votetype,
            voteProposalText: _message,
            voteStatus: 1,
            voteends: _voteends,
            receiver: _pool,
            tokenID: handler,
            amount: minPoolAmount,
            votersLeft: vt.familyMembers - 1,
            familyDao: _familyDao,
            numTokenFor: _numTokens,
            numTokenAgainst: 0
        });
        vt.votingStatus[vt.voteid][msgSender_] = true;
       if (_numTokens>0 && _familyDao == 1) {VoteProposalLib._burn(msgSender_, _numTokens);}

       yt.addresses[vt.voteid]= _tokenIDs;
       yt.amounts[vt.voteid] = _amounts;
       emit VoteProposalLib.VoteStatus(
            vt.voteid,
            msgSender_,
            1,
            block.timestamp
        ); 

        unchecked {
            vt.voteid++;
        }
        VoteProposalLib.checkForwarder();
    }
    
   modifier checkValidity(uint256 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }

    function executeCurveExchange(
        uint256 _id,
        address handler,
        int128 i,
        int128 j,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 410) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =410;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address tokenJ = vt.voteProposalAttributes[_id].receiver;
        uint amount = vt.voteProposalAttributes[_id].amount;

         (uint256 _amount, uint256 balanceBefore, uint256 ethAmount) =
            _exchangeBefore(handler, tokenI, tokenJ, amount);

             try
            ICurveHandler(handler).exchange{value: ethAmount}(
                i,
                j,
                _amount,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exchange");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            410,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 

        return _exchangeAfter(handler, tokenI, tokenJ, balanceBefore);
    }

     /// @notice Curve exchange with uint256 ij
     function exchangeUint256(
        uint256 _id,
        address handler,
        uint256 i,
        uint256 j,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
        
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        
        if (vt.voteProposalAttributes[_id].voteType != 411) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =411;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address tokenJ = vt.voteProposalAttributes[_id].receiver;
        uint256 amount = vt.voteProposalAttributes[_id].amount;

         (uint256 _amount, uint256 balanceBefore, uint256 ethAmount) =
            _exchangeBefore(handler, tokenI, tokenJ, amount);

             try
            ICurveHandler(handler).exchange{value: ethAmount}(
                i,
                j,
                _amount,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exchangeUint256");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            411,
            block.timestamp
        ); 
        
        VoteProposalLib.checkForwarder(); 

        return _exchangeAfter(handler, tokenI, tokenJ, balanceBefore);
    }

    /// @notice Curve exchange with uint256 ij and ether flag
     function exchangeUint256Ether(
        uint256 _id,
        address handler,
        uint256 i,
        uint256 j,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 412) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus = 412;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address tokenJ = vt.voteProposalAttributes[_id].receiver;
        uint amount = vt.voteProposalAttributes[_id].amount;

         (uint256 _amount, uint256 balanceBefore, uint256 ethAmount) =
            _exchangeBefore(handler, tokenI, tokenJ, amount);

        try
            ICurveHandler(handler).exchange{value: ethAmount}(
                i,
                j,
                _amount,
                minAmount,
                true
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exchangeUint256Ether");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            412,
            block.timestamp
        ); 
       
        VoteProposalLib.checkForwarder(); 

        return _exchangeAfter(handler, tokenI, tokenJ, balanceBefore);
    }


    function exchangeUnderlying(
        uint256 _id,
        address handler,
        int128 i,
        int128 j,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 413) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =413;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address tokenJ = vt.voteProposalAttributes[_id].receiver;
        uint amount = vt.voteProposalAttributes[_id].amount;

         (uint256 _amount, uint256 balanceBefore, uint256 ethAmount) =
            _exchangeBefore(handler, tokenI, tokenJ, amount);

             try
            ICurveHandler(handler).exchange_underlying{value: ethAmount}(
                i,
                j,
                _amount,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exchangeUnderlying");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            413,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
        return _exchangeAfter(handler, tokenI, tokenJ, balanceBefore);
    }

    function exchangeUnderlyingFactoryZap(
        uint256 _id,
        address handler,
        address pool,
        int128 i,
        int128 j
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 414) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =414;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address tokenJ = vt.voteProposalAttributes[_id].receiver;
        uint amount = vt.voteProposalAttributes[_id].amount;
        uint256 minAmount = vt.voteProposalAttributes[_id].voteends;

         (uint256 _amount, uint256 balanceBefore, uint256 ethAmount) =
            _exchangeBefore(handler, tokenI, tokenJ, amount);

        try
            ICurveHandler(handler).exchange_underlying{value: ethAmount}(
                pool,
                i,
                j,
                _amount,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exchangeUnderlyingFactoryZap");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            414,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
        return _exchangeAfter(handler, tokenI, tokenJ, balanceBefore);
    }

     function exchangeUnderlyingUint256(
        uint256 _id,
        address handler,
        uint256 i,
        uint256 j,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 415) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =415;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address tokenJ = vt.voteProposalAttributes[_id].receiver;
        uint amount = vt.voteProposalAttributes[_id].amount;

         (uint256 _amount, uint256 balanceBefore, uint256 ethAmount) =
            _exchangeBefore(handler, tokenI, tokenJ, amount);

             try
            ICurveHandler(handler).exchange_underlying{value: ethAmount}(
                i,
                j,
                _amount,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("exchangeUnderlying");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            415,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
        return _exchangeAfter(handler, tokenI, tokenJ, balanceBefore);
    }

      function _exchangeBefore(
        address handler,
        address tokenI,
        address tokenJ,
        uint256 amount
    )
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        amount = _getBalance(tokenI, amount);
        uint256 balanceBefore = _getBalance(tokenJ, type(uint256).max);
        // Approve erc20 token or set eth amount
        uint256 ethAmount;
        if (tokenI != NATIVE_TOKEN_ADDRESS) {
            _tokenApprove(tokenI, handler, amount);
        } else {
            ethAmount = amount;
        }
        return (amount, balanceBefore, ethAmount);
    }

     function _exchangeAfter(
        address handler,
        address tokenI,
        address tokenJ,
        uint256 balanceBefore
    ) internal returns (uint256) {
        uint256 balance = _getBalance(tokenJ, type(uint256).max);
        if ( balance <= balanceBefore) {
            revert COULD_NOT_PROCESS("after <= before");
        }      
        if (tokenI != NATIVE_TOKEN_ADDRESS) _tokenApproveZero(tokenI, handler);
        return balance - balanceBefore;
    }


  /// @notice Curve add liquidity


   function addLiquidity(
        uint256 _id
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        YearnStorage storage yt = YearnStorageTracking();
        if (vt.voteProposalAttributes[_id].voteType != 416) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =416;

         address handler = vt.voteProposalAttributes[_id].tokenID;
         address pool = vt.voteProposalAttributes[_id].receiver;
         address [] memory tokens = yt.addresses[_id];
         uint [] memory amounts = yt.amounts[_id];
         uint256 minPoolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256[] memory _amounts, uint256 balanceBefore, uint256 ethAmount) =
            _addLiquidityBefore(handler, pool,tokens, amounts); 

         // Execute add_liquidity according to amount array size
        if (_amounts.length == 2) {
            uint256[2] memory amts = [_amounts[0], _amounts[1]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidity");
        }
        } else if (_amounts.length == 3) {
            uint256[3] memory amts = [_amounts[0], _amounts[1], _amounts[2]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidity");
        }
        } else if (_amounts.length == 4) {
            uint256[4] memory amts =
                [_amounts[0], _amounts[1], _amounts[2], _amounts[3]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidity");
        }
        } else if (_amounts.length == 5) {
            uint256[5] memory amts =
                [
                    _amounts[0],
                    _amounts[1],
                    _amounts[2],
                    _amounts[3],
                    _amounts[4]
                ];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidity");
        }
        } else if (_amounts.length == 6) {
            uint256[6] memory amts =
                [
                    _amounts[0],
                    _amounts[1],
                    _amounts[2],
                    _amounts[3],
                    _amounts[4],
                    _amounts[5]
                ];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidity");
        }
        } else {
            revert COULD_NOT_PROCESS("invalid amount[] size");
        }
      
        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            416,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
       return
            _addLiquidityAfter(handler, pool, tokens, amounts, balanceBefore);
    }


   function addLiquidityUnderlying(
        uint256 _id
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        YearnStorage storage yt = YearnStorageTracking();
        if (vt.voteProposalAttributes[_id].voteType != 417) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =417;

         address handler = vt.voteProposalAttributes[_id].tokenID;
         address pool = vt.voteProposalAttributes[_id].receiver;
         address [] memory tokens = yt.addresses[_id];
         uint [] memory amounts = yt.amounts[_id];
         uint256 minPoolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256[] memory _amounts, uint256 balanceBefore, uint256 ethAmount) =
            _addLiquidityBefore(handler, pool,tokens, amounts); 

         // Execute add_liquidity according to amount array size
        if (_amounts.length == 2) {
            uint256[2] memory amts = [_amounts[0], _amounts[1]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount,
                    true
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityUnderlying");
        }
        } else if (_amounts.length == 3) {
            uint256[3] memory amts = [_amounts[0], _amounts[1], _amounts[2]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount,
                    true
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityUnderlying");
        }
        } else if (_amounts.length == 4) {
            uint256[4] memory amts =
                [_amounts[0], _amounts[1], _amounts[2], _amounts[3]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount,
                    true
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityUnderlying");
        }
        } else if (_amounts.length == 5) {
            uint256[5] memory amts =
                [
                    _amounts[0],
                    _amounts[1],
                    _amounts[2],
                    _amounts[3],
                    _amounts[4]
                ];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount,
                    true
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityUnderlying");
        }
        } else if (_amounts.length == 6) {
            uint256[6] memory amts =
                [
                    _amounts[0],
                    _amounts[1],
                    _amounts[2],
                    _amounts[3],
                    _amounts[4],
                    _amounts[5]
                ];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    amts,
                    minPoolAmount,
                    true
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityUnderlying");
        }
        } else {
            revert COULD_NOT_PROCESS("invalid amount[] size");
        }
      
        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            417,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
       return
            _addLiquidityAfter(handler, pool, tokens, amounts, balanceBefore);
    }

    function addLiquidityFactoryZap(
        uint256 _id
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        YearnStorage storage yt = YearnStorageTracking();
        if (vt.voteProposalAttributes[_id].voteType != 418) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =418;

         address handler = vt.voteProposalAttributes[_id].tokenID;
         address pool = vt.voteProposalAttributes[_id].receiver;
         address [] memory tokens = yt.addresses[_id];
         uint [] memory amounts = yt.amounts[_id];
         uint256 minPoolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256[] memory _amounts, uint256 balanceBefore, uint256 ethAmount) =
            _addLiquidityBefore(handler, pool,tokens, amounts); 

         // Execute add_liquidity according to amount array size
        if (_amounts.length == 3) {
            uint256[3] memory amts = [_amounts[0], _amounts[1], _amounts[2]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    pool,
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityFactoryZap");
        }
        } else if (_amounts.length == 4) {
            uint256[4] memory amts =
                [_amounts[0], _amounts[1], _amounts[2], _amounts[3]];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    pool,
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityFactoryZap");
        }
        } else if (_amounts.length == 5) {
            uint256[5] memory amts =
                [
                    _amounts[0],
                    _amounts[1],
                    _amounts[2],
                    _amounts[3],
                    _amounts[4]
                ];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    pool,
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityFactoryZap");
        }
        } else if (_amounts.length == 6) {
            uint256[6] memory amts =
                [
                    _amounts[0],
                    _amounts[1],
                    _amounts[2],
                    _amounts[3],
                    _amounts[4],
                    _amounts[5]
                ];
            try
                ICurveHandler(handler).add_liquidity{value: ethAmount}(
                    pool,
                    amts,
                    minPoolAmount
                )
            {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("addLiquidityFactoryZap");
        }
        } else {
            revert COULD_NOT_PROCESS("invalid amount[] size");
        }
      
        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            418,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
       return
            _addLiquidityAfter(handler, pool, tokens, amounts, balanceBefore);
    }


 function _addLiquidityBefore(
        address handler,
        address pool,
        address[] memory tokens,
        uint256[] memory amounts
    )
        internal
        returns (
            uint256[] memory,
            uint256,
            uint256
        )
    {
        uint256 balanceBefore = IERC20(pool).balanceOf(address(this));

        // Approve non-zero amount erc20 token and set eth amount
        uint256 ethAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            amounts[i] = _getBalance(tokens[i], amounts[i]);
            if (tokens[i] == NATIVE_TOKEN_ADDRESS) {
                ethAmount = amounts[i];
                continue;
            }
            _tokenApprove(tokens[i], handler, amounts[i]);
        }

        return (amounts, balanceBefore, ethAmount);
    }

    function _addLiquidityAfter(
        address handler,
        address pool,
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 balanceBefore
    ) internal returns (uint256) {
        uint256 balance = IERC20(pool).balanceOf(address(this));

        if (balance <= balanceBefore) {
            revert COULD_NOT_PROCESS("after <= before");
        }  

        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] == 0) continue;
            if (tokens[i] != NATIVE_TOKEN_ADDRESS)
                _tokenApproveZero(tokens[i], handler);
        }
        return balance - balanceBefore;
    }

  function removeLiquidityOneCoin(
        uint256 _id,
        address handler,
        int128 i,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 419) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =419;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address pool = vt.voteProposalAttributes[_id].receiver;
        uint poolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256 _poolAmount, uint256 balanceBefore) =
            _removeLiquidityOneCoinBefore(handler, pool, tokenI, poolAmount);

            try
            ICurveHandler(handler).remove_liquidity_one_coin(
                _poolAmount,
                i,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("removeLiquidityOneCoin");
        }


        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            419,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    return
            _removeLiquidityOneCoinAfter(handler, pool, tokenI, balanceBefore);
    }

    function removeLiquidityOneCoinUint256(
        uint256 _id,
        address handler,
        uint256 i,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 420) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =420;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address pool = vt.voteProposalAttributes[_id].receiver;
        uint poolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256 _poolAmount, uint256 balanceBefore) =
            _removeLiquidityOneCoinBefore(handler, pool, tokenI, poolAmount);

            try
            ICurveHandler(handler).remove_liquidity_one_coin(
                _poolAmount,
                i,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("removeLiquidityOneCoinUint256");
        }


        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            420,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    return
            _removeLiquidityOneCoinAfter(handler, pool, tokenI, balanceBefore);
    }

    function removeLiquidityOneCoinUnderlying(
        uint256 _id,
        address handler,
        int128 i,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 421) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =421;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address pool = vt.voteProposalAttributes[_id].receiver;
        uint poolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256 _poolAmount, uint256 balanceBefore) =
            _removeLiquidityOneCoinBefore(handler, pool, tokenI, poolAmount);

            try
            ICurveHandler(handler).remove_liquidity_one_coin(
                _poolAmount,
                i,
                minAmount,
                true
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("removeLiquidityOneCoinUnderlying");
        }


        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            421,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    return
            _removeLiquidityOneCoinAfter(handler, pool, tokenI, balanceBefore);
    }

    function removeLiquidityOneCoinUnderlyingUint256(
        uint256 _id,
        address handler,
        uint256 i,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 422) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =422;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address pool = vt.voteProposalAttributes[_id].receiver;
        uint poolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256 _poolAmount, uint256 balanceBefore) =
            _removeLiquidityOneCoinBefore(handler, pool, tokenI, poolAmount);

            try
            ICurveHandler(handler).remove_liquidity_one_coin(
                _poolAmount,
                i,
                minAmount,
                true
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("removeLiquidityOneCoinUnderlyingUint256");
        }


        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            422,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    return
            _removeLiquidityOneCoinAfter(handler, pool, tokenI, balanceBefore);
    }

    function removeLiquidityOneCoinFactoryZap(
        uint256 _id,
        address handler,
        int128 i,
        uint256 minAmount
    ) external checkValidity(_id) returns (uint){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 423) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =423;
        
        address tokenI = vt.voteProposalAttributes[_id].tokenID;
        address pool = vt.voteProposalAttributes[_id].receiver;
        uint poolAmount = vt.voteProposalAttributes[_id].amount;

          (uint256 _poolAmount, uint256 balanceBefore) =
            _removeLiquidityOneCoinBefore(handler, pool, tokenI, poolAmount);

            try
            ICurveHandler(handler).remove_liquidity_one_coin(
                pool,
                _poolAmount,
                i,
                minAmount
            )
        {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("removeLiquidityOneCoinFactoryZap");
        }


        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            423,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    return
            _removeLiquidityOneCoinAfter(handler, pool, tokenI, balanceBefore);
    }

     function _removeLiquidityOneCoinBefore(
        address handler,
        address pool,
        address tokenI,
        uint256 poolAmount
    ) internal returns (uint256, uint256) {
        uint256 balanceBefore = _getBalance(tokenI, type(uint256).max);
        poolAmount = _getBalance(pool, poolAmount);
        _tokenApprove(pool, handler, poolAmount);
        return (poolAmount, balanceBefore);
    }

    function _removeLiquidityOneCoinAfter(
        address handler,
        address pool,
        address tokenI,
        uint256 balanceBefore
    ) internal returns (uint256) {
        // Some curve non-underlying pools like 3pool won't consume pool token
        // allowance since pool token was issued by the pool that don't need to
        // call transferFrom(). So set approval to 0 here.
        _tokenApproveZero(pool, handler);
        uint256 balance = _getBalance(tokenI, type(uint256).max);
       if (balance <= balanceBefore) {
            revert COULD_NOT_PROCESS("after <= before");
        } 
        return balance - balanceBefore;
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


    function depositCurve(
        uint256 _id
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
        uint256 _id
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

