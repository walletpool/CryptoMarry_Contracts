// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {VoteProposalLib} from "../../libraries/VotingStatusLib.sol";
import { IDiamondCut } from "../../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/MinimalForwarderUpgradeable.sol";
import "@gnus.ai/contracts-upgradeable-diamond/metatx/ERC2771ContextUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../handlerBase.sol";
import "./IDSProxy.sol";
import "./IMaker.sol";

////Need to thoroughly test this integration. Need to write init function to handle build in Proxy Factory. 

contract MakerFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);

    address public immutable PROXY_REGISTRY_MAKER;
    address public immutable DAI_TOKEN_MAKER;
    address public immutable CHAIN_LOG_MAKER;
    address public immutable CDP_MANAGER_MAKER;
    address public immutable PROXY_ACTIONS_MAKER;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _PROXY_REGISTRY, address _DAI_TOKEN, 
                    address _CHAIN_LOG, address _CDP_MANAGER, address _PROXY_ACTIONS)
        ERC2771ContextUpgradeable(address(forwarder))
        {   DAI_TOKEN_MAKER = _DAI_TOKEN;
            PROXY_REGISTRY_MAKER = _PROXY_REGISTRY;
            CHAIN_LOG_MAKER=_CHAIN_LOG;
            CDP_MANAGER_MAKER = _CDP_MANAGER;
            PROXY_ACTIONS_MAKER=_PROXY_ACTIONS;
        }
    
    bytes32 constant MT_STORAGE_POSITION =
        keccak256("waverimplementation.MakerApp.CDPStorage"); //Storing position of the variables


    struct MakerStorage {
        mapping(address => uint256) CDP;
    }

    function MakerStorageTracking()
        internal
        pure
        returns (MakerStorage storage mt)
    {
        bytes32 position = MT_STORAGE_POSITION;
        assembly {
            mt.slot := position
        }
    }

    function getCDP(address token) public view returns (uint) {
        MakerStorage storage mt = MakerStorageTracking();
        return mt.CDP[token];
    }

    function getMcdJug() public view returns (address) {
        return IMakerChainLog(CHAIN_LOG_MAKER).getAddress("MCD_JUG");
    }

    function cdpAllowed(address token) internal view returns (uint256 cdp) {
        IMakerManager manager = IMakerManager(CDP_MANAGER_MAKER);
        MakerStorage storage mt = MakerStorageTracking();
        cdp = mt.CDP[token];
        address owner = manager.owns(cdp);
        address sender = address(this);
        if (IDSProxyRegistry(PROXY_REGISTRY_MAKER).proxies(sender) != owner && manager.cdpCan(owner, cdp, sender) != 1)
        revert COULD_NOT_PROCESS("Unauthorized sender of cdp");
        return cdp;
    }

     modifier checkValidity(uint24 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }

    function openLockETHAndDraw(
        uint24 _id
    ) external checkValidity(_id) payable returns (uint256 cdp){
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();

        //openLockETHAndDraw
        if (vt.voteProposalAttributes[_id].voteType != 130) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =130;
           MakerStorage storage mt = MakerStorageTracking();

        uint256 value = vt.voteProposalAttributes[_id].amount;
        address ethJoin = vt.voteProposalAttributes[_id].tokenID;
        address daiJoin = vt.voteProposalAttributes[_id].receiver;

        //This is super awkward
        uint256 wadD = vt.voteProposalAttributes[_id].voteends;
        bytes32 ilk = bytes32(vt.voteProposalAttributes[_id].voteProposalText);

        IDSProxy proxy = IDSProxy(_getProxy());

        // if amount == type(uint256).max return balance of Proxy
        value = _getBalance(address(0), value);
        require(mt.CDP[address(1)] == 0);

          try
            proxy.execute{value: value}(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                    // selector of "openLockETHAndDraw(address,address,address,address,bytes32,uint256)"
                    0xe685cc04,
                    CDP_MANAGER_MAKER,
                    getMcdJug(),
                    ethJoin,
                    daiJoin,
                    ilk,
                    wadD
                )
            )
        returns (bytes32 ret) {
            cdp = uint256(ret);
            mt.CDP[address(1)] = cdp;
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("openLockETHAndDraw");
        
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            130,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function openLockGemAndDraw(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 131) {revert COULD_NOT_PROCESS('wrong type');}
           vt.voteProposalAttributes[_id].voteStatus =131;

         MakerStorage storage mt = MakerStorageTracking();


        address gemJoin = vt.voteProposalAttributes[_id].tokenID;
        address daiJoin = vt.voteProposalAttributes[_id].receiver;
        uint256 wadC = vt.voteProposalAttributes[_id].amount;
        //This is super awkward
        uint256 wadD = vt.voteProposalAttributes[_id].voteends;
        bytes32 ilk = bytes32(vt.voteProposalAttributes[_id].voteProposalText);

        IDSProxy proxy = IDSProxy(_getProxy());
        address token = IMakerGemJoin(gemJoin).gem();
        require(mt.CDP[token] == 0);
        // if amount == type(uint256).max return balance of Proxy
        wadC = _getBalance(token, wadC);
        _tokenApprove(token, address(proxy), wadC);

          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                   // selector of "openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)"
                    0xdb802a32,
                    CDP_MANAGER_MAKER,
                    getMcdJug(),
                    gemJoin,
                    daiJoin,
                    ilk,
                    wadC,
                    wadD,
                    true
                )
            )
        returns (bytes32 ret) {
            mt.CDP[token] = uint256(ret);
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("openLockGemAndDraw");
        
        }
         _tokenApproveZero(token, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            131,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }


     function safeLockETH(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 132) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =132;
         
        uint256 value = vt.voteProposalAttributes[_id].amount;
        address ethJoin = vt.voteProposalAttributes[_id].tokenID;
        address owner = _getProxy();
       
        MakerStorage storage mt = MakerStorageTracking();
        uint256 cdp = mt.CDP[address(1)];
           
        IDSProxy proxy = IDSProxy(_getProxy());

        // if amount == type(uint256).max return balance of Proxy
        value = _getBalance(address(0), value);

          try
            proxy.execute{value: value}(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                    // selector of "safeLockETH(address,address,uint256,address)"
                    0xee284576,
                    CDP_MANAGER_MAKER,
                    ethJoin,
                    cdp,
                    owner
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("safeLockETH");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            132,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function safeLockGem(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 133) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =133;

        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address gemJoin = vt.voteProposalAttributes[_id].tokenID;
        address owner = _getProxy();
        address token = IMakerGemJoin(gemJoin).gem();
        
        MakerStorage storage mt = MakerStorageTracking();
        uint256 cdp = mt.CDP[token];
        
        IDSProxy proxy = IDSProxy(_getProxy());
        // if amount == type(uint256).max return balance of Proxy
        wad = _getBalance(token, wad);
        _tokenApprove(token, address(proxy), wad);

          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                     // selector of "safeLockGem(address,address,uint256,uint256,bool,address)"
                    0xead64729,
                    CDP_MANAGER_MAKER,
                    gemJoin,
                    cdp,
                    wad,
                    true,
                    owner
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("safeLockGem");
        }

         _tokenApproveZero(token, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            133,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function freeETH(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 134) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =134;
        uint256 cdp = cdpAllowed(address(1)); 
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address ethJoin = vt.voteProposalAttributes[_id].tokenID;
                  
        IDSProxy proxy = IDSProxy(_getProxy());

          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                    // selector of "freeETH(address,address,uint256,uint256)"
                    0x7b5a3b43,
                    CDP_MANAGER_MAKER,
                    ethJoin,
                    cdp,
                    wad
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("freeETH");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            134,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function freeGem(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 135) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =135;
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address gemJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;

         uint256 cdp = cdpAllowed(token);
           
        IDSProxy proxy = IDSProxy(_getProxy());
          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                     // selector of "freeGem(address,address,uint256,uint256)"
                    0x6ab6a491,
                    CDP_MANAGER_MAKER,
                    gemJoin,
                    cdp,
                    wad
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("freeGem");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            135,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function draw(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 136) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =136;
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address daiJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;

        uint256 cdp = cdpAllowed(token);
       
        IDSProxy proxy = IDSProxy(_getProxy());
          
          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                     // selector of "draw(address,address,address,uint256,uint256)"
                    0x9f6f3d5b,
                    CDP_MANAGER_MAKER,
                    getMcdJug(),
                    daiJoin,
                    cdp,
                    wad
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("draw");
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            136,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function wipe(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 137) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =137;
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address daiJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;
       
        MakerStorage storage mt = MakerStorageTracking();
        uint256 cdp = mt.CDP[token];
           
        IDSProxy proxy = IDSProxy(_getProxy());
         _tokenApprove(DAI_TOKEN_MAKER, address(proxy), wad);
          
          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                     // selector of "wipe(address,address,uint256,uint256)"
                    0x4b666199,
                    CDP_MANAGER_MAKER,
                    daiJoin,
                    cdp,
                    wad
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("wipe");
        }

        _tokenApproveZero(DAI_TOKEN_MAKER, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            137,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function wipeAll(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 138) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =138;
         
        address daiJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;
       
        MakerStorage storage mt = MakerStorageTracking();
        uint256 cdp = mt.CDP[token];
           
        IDSProxy proxy = IDSProxy(_getProxy());
        _tokenApprove(DAI_TOKEN_MAKER, address(proxy), type(uint256).max);
          
          try
            proxy.execute(
                PROXY_ACTIONS_MAKER,
                abi.encodeWithSelector(
                     // selector of "wipeAll(address,address,uint256)"
                    0x036a2395,
                    CDP_MANAGER_MAKER,
                    daiJoin,
                    cdp
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("wipeAll");
        }

        _tokenApproveZero(DAI_TOKEN_MAKER, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            138,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }


     function _getProxy() public view returns (address) {
        return IDSProxyRegistry(PROXY_REGISTRY_MAKER).proxies(address(this));
    }




    


    
    
    
    
    
    
    
    }