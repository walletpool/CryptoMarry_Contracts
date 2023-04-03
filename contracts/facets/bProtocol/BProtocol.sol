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
import "../maker/IDSProxy.sol";
import "../maker/IMaker.sol";

////Need to thoroughly test this integration. Need to write init function to handle build in Proxy Factory. 

contract BProtocolFacet is ERC2771ContextUpgradeable, HandlerBase {
    using SafeERC20 for IERC20;
    error COULD_NOT_PROCESS(string);

    address public immutable BP_PROXY_REGISTRY;
    address public immutable BP_DAI_TOKEN;
    address public immutable BP_CHAIN_LOG;
    address public immutable BP_CDP_MANAGER;
    address public immutable BP_PROXY_ACTIONS;
    
    constructor(MinimalForwarderUpgradeable forwarder, address _PROXY_REGISTRY, address _DAI_TOKEN, 
                    address _CHAIN_LOG, address _CDP_MANAGER, address _PROXY_ACTIONS)
        ERC2771ContextUpgradeable(address(forwarder))
        {   BP_DAI_TOKEN = _DAI_TOKEN;
            BP_PROXY_REGISTRY = _PROXY_REGISTRY;
            BP_CHAIN_LOG=_CHAIN_LOG;
            BP_CDP_MANAGER = _CDP_MANAGER;
            BP_PROXY_ACTIONS=_PROXY_ACTIONS;
        }
    
    bytes32 constant BP_STORAGE_POSITION =
        keccak256("waverimplementation.BPApp.CDPStorage"); //Storing position of the variables


    struct BProtocolStorage {
        mapping(address => uint256) CDP;
    }

    function BProtocolStorageTracking()
        internal
        pure
        returns (BProtocolStorage storage bp)
    {
        bytes32 position = BP_STORAGE_POSITION;
        assembly {
            bp.slot := position
        }
    }

    function getCDPBP(address token) public view returns (uint) {
        BProtocolStorage storage bp = BProtocolStorageTracking();
        return bp.CDP[token];
    }

    function getBPMcdJug() public view returns (address) {
        return IMakerChainLog(BP_CHAIN_LOG).getAddress("MCD_JUG");
    }

    function cdpAllowed(address token) internal view returns (uint256 cdp) {
        IMakerManager manager = IMakerManager(BP_CDP_MANAGER);
        BProtocolStorage storage bp = BProtocolStorageTracking();
        cdp= bp.CDP[token];
        address owner = manager.owns(cdp);
        address sender = address(this);
        if (IDSProxyRegistry(BP_PROXY_REGISTRY).proxies(sender) != owner && manager.cdpCan(owner, cdp, sender) != 1)
        revert COULD_NOT_PROCESS("Unauthorized sender of cdp");
        return cdp;
    }

     modifier checkValidity(uint24 _id) {  
            VoteProposalLib.enforceMarried();
            VoteProposalLib.enforceUserHasAccess(_msgSender());
            VoteProposalLib.enforceAcceptedStatus(_id);    
            _;
    }

    function openLockETHAndDrawBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 700) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =700;
         BProtocolStorage storage bp = BProtocolStorageTracking();

        uint256 value = vt.voteProposalAttributes[_id].amount;
        address ethJoin = vt.voteProposalAttributes[_id].tokenID;
        address daiJoin = vt.voteProposalAttributes[_id].receiver;

        //This is super awkward
        uint256 wadD = vt.voteProposalAttributes[_id].voteends;
        bytes32 ilk = bytes32(vt.voteProposalAttributes[_id].voteProposalText);

        IDSProxy proxy = IDSProxy(_getProxyBP());

        // if amount == type(uint256).max return balance of Proxy
        value = _getBalance(address(0), value);
        require(bp.CDP[address(1)] == 0);

          try
            proxy.execute{value: value}(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                    // selector of "openLockETHAndDraw(address,address,address,address,bytes32,uint256)"
                    0xe685cc04,
                    BP_CDP_MANAGER,
                    getBPMcdJug(),
                    ethJoin,
                    daiJoin,
                    ilk,
                    wadD
                )
            )
        returns (bytes32 ret) {
            bp.CDP[address(1)] = uint256(ret);
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("openLockETHAndDraw");
        
        }

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            700,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }


     function openLockGemAndDrawBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 701) {revert COULD_NOT_PROCESS('wrong type');}
           vt.voteProposalAttributes[_id].voteStatus =701;
            BProtocolStorage storage bp = BProtocolStorageTracking();

        address gemJoin = vt.voteProposalAttributes[_id].tokenID;
        address daiJoin = vt.voteProposalAttributes[_id].receiver;
        uint256 wadC = vt.voteProposalAttributes[_id].amount;
        //This is super awkward
        uint256 wadD = vt.voteProposalAttributes[_id].voteends;
        bytes32 ilk = bytes32(vt.voteProposalAttributes[_id].voteProposalText);

        IDSProxy proxy = IDSProxy(_getProxyBP());
        address token = IMakerGemJoin(gemJoin).gem();
        require(bp.CDP[token] == 0);

        // if amount == type(uint256).max return balance of Proxy
        wadC = _getBalance(token, wadC);
        _tokenApprove(token, address(proxy), wadC);

          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                   // selector of "openLockGemAndDraw(address,address,address,address,bytes32,uint256,uint256,bool)"
                    0xdb802a32,
                    BP_CDP_MANAGER,
                    getBPMcdJug(),
                    gemJoin,
                    daiJoin,
                    ilk,
                    wadC,
                    wadD,
                    true
                )
            )
        returns (bytes32 ret) {
            bp.CDP[token] = uint256(ret);
        } catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("openLockGemAndDraw");
        
        }
         _tokenApproveZero(token, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            701,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }


     function safeLockETHBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 702) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =702;
         
        uint256 value = vt.voteProposalAttributes[_id].amount;
        address ethJoin = vt.voteProposalAttributes[_id].tokenID;
        address owner = _getProxyBP();
       
        BProtocolStorage storage bp = BProtocolStorageTracking();
        uint256 cdp = bp.CDP[address(1)];
           
        IDSProxy proxy = IDSProxy(_getProxyBP());

        // if amount == type(uint256).max return balance of Proxy
        value = _getBalance(address(0), value);

          try
            proxy.execute{value: value}(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                    // selector of "safeLockETH(address,address,uint256,address)"
                    0xee284576,
                    BP_CDP_MANAGER,
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
            702,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function safeLockGemBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 703) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =703;

        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address gemJoin = vt.voteProposalAttributes[_id].tokenID;
        address owner = _getProxyBP();
        address token = IMakerGemJoin(gemJoin).gem();
        
        BProtocolStorage storage bp = BProtocolStorageTracking();
        uint256 cdp = bp.CDP[token];
        
        IDSProxy proxy = IDSProxy(_getProxyBP());
        // if amount == type(uint256).max return balance of Proxy
        wad = _getBalance(token, wad);
        _tokenApprove(token, address(proxy), wad);

          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                     // selector of "safeLockGem(address,address,uint256,uint256,bool,address)"
                    0xead64729,
                    BP_CDP_MANAGER,
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
            703,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function freeETHBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 704) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =704;

        uint256 cdp = cdpAllowed(address(1));
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address ethJoin = vt.voteProposalAttributes[_id].tokenID;
           
        IDSProxy proxy = IDSProxy(_getProxyBP());

          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                    // selector of "freeETH(address,address,uint256,uint256)"
                    0x7b5a3b43,
                    BP_CDP_MANAGER,
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
            704,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function freeGemBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 705) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =705;
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address gemJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;
        uint256 cdp = cdpAllowed(token);
           
        IDSProxy proxy = IDSProxy(_getProxyBP());
          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                     // selector of "freeGem(address,address,uint256,uint256)"
                    0x6ab6a491,
                    BP_CDP_MANAGER,
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
            705,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function drawBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 706) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =706;
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address daiJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;
        uint256 cdp = cdpAllowed(token);
                  
        IDSProxy proxy = IDSProxy(_getProxyBP());
          
          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                     // selector of "draw(address,address,address,uint256,uint256)"
                    0x9f6f3d5b,
                    BP_CDP_MANAGER,
                    getBPMcdJug(),
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
            706,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function wipeBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 707) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =707;
         
        uint256 wad = vt.voteProposalAttributes[_id].amount;
        address daiJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;
       
        BProtocolStorage storage bp = BProtocolStorageTracking();
        uint256 cdp = bp.CDP[token];
           
        IDSProxy proxy = IDSProxy(_getProxyBP());
         _tokenApprove(BP_DAI_TOKEN, address(proxy), wad);
          
          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                     // selector of "wipe(address,address,uint256,uint256)"
                    0x4b666199,
                    BP_CDP_MANAGER,
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

        _tokenApproveZero(BP_DAI_TOKEN, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            707,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

    function wipeAllBP(
        uint24 _id
    ) external checkValidity(_id) payable {
         VoteProposalLib.VoteTracking storage vt = VoteProposalLib
            .VoteTrackingStorage();
        if (vt.voteProposalAttributes[_id].voteType != 708) {revert COULD_NOT_PROCESS('wrong type');}
         vt.voteProposalAttributes[_id].voteStatus =708;
         
        address daiJoin = vt.voteProposalAttributes[_id].tokenID;
        address token = vt.voteProposalAttributes[_id].receiver;
       
        BProtocolStorage storage bp = BProtocolStorageTracking();
        uint256 cdp = bp.CDP[token];
           
        IDSProxy proxy = IDSProxy(_getProxyBP());
        _tokenApprove(BP_DAI_TOKEN, address(proxy), type(uint256).max);
          
          try
            proxy.execute(
                BP_PROXY_ACTIONS,
                abi.encodeWithSelector(
                     // selector of "wipeAll(address,address,uint256)"
                    0x036a2395,
                    BP_CDP_MANAGER,
                    daiJoin,
                    cdp
                )
            )

      {} catch Error(string memory reason) {
            revert COULD_NOT_PROCESS(reason);
        } catch {
            revert COULD_NOT_PROCESS("wipeAll");
        }

        _tokenApproveZero(BP_DAI_TOKEN, address(proxy));

        emit VoteProposalLib.VoteStatus(
            _id,
            _msgSender(),
            708,
            block.timestamp
        ); 
        VoteProposalLib.checkForwarder(); 
    }

     function _getProxyBP() public view returns (address) {
        return IDSProxyRegistry(BP_PROXY_REGISTRY).proxies(address(this));
    }




    


    
    
    
    
    
    
    
    }