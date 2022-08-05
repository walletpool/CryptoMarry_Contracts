// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/MinimalForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "./SecuredTokenTransfer.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
pragma abicoder v2;

/// [MIT License]
/// @title This is proxy contract implementation, used as shared wallets of users
/// @notice Through this contract all interactions occur within each family
/// @author Ismailov Altynbek <altyni@gmail.com>

//Functions to interact with the main contract
abstract contract WaverContract {
    function mint(address _to, uint256 _amount) external virtual;
    function balanceOf(address _to) external virtual returns (uint256);
    function burn(address _to, uint256 _amount) external virtual;
    function policyDays() external virtual returns (uint256);
    function saleCap() external virtual returns (uint256);
    function addFamilyMember(address, uint256) external virtual;
    function deleteFamilyMember(address) external virtual;
    function divorceUpdate(uint256 _id) external virtual;
    function addressNFTSplit() external virtual returns (address);
    function poolFee() external virtual returns (uint24);
    function cmFee() external virtual returns (uint256);
}

//Functions to split NFTs

abstract contract nftSplitInstance {
function splitNFT (address _nft_Address, uint _tokenID, string memory nft_json1,string memory nft_json2, address waver, address proposed, address _implementationAddr) external virtual;
}

abstract contract CErc20 {
    function mint(uint256) external virtual returns (uint256);
    function redeem(uint) external virtual returns (uint);
}

abstract contract CEth {
    function mint() external virtual payable;
    function redeem(uint) external virtual returns (uint);
}
interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

contract WaverImplementation is
    Initializable,
    ReentrancyGuardUpgradeable,
    ERC2771ContextUpgradeable,
    SecuredTokenTransfer
{
     
    //Variables to check different statuses
    uint256 internal voteid; //tracking multiple voting initiatives
    uint256 public familyMembers;
    address internal forwarderAddr;

    //main Addresses for the contract
    address internal addressWaveContract;

    // Address for uniswap router 

    IUniswapRouter public swapRouter;

    //Family Statuses
    uint8 public MarriageStatus; // 2 Divorced
    uint256 public MarryDate;


    
    //Structs
    struct Wave {
        uint256 id;
        address waver;
        address proposed;
    }

    enum Status{
        notProposed,
        Proposed,
        Accepted,
        Declined,
        Cancelled,
        Paid,
        Divorced,
        Invested,
        Redeemed,
        SwapSubmitted,
        NFTsent,
        FamilyAdded,
        FamilyDeleted,
        Tokenclaimed
    }

     enum Type{
         notProposed,
         simpleVote,
         TransferERC20,
         TransferETH,
         Divorce,
         TransferNFT,
         InvestETH,
         InvestERC20,
         RedeemETH,
         RedeemERC20,
         ERC20Swap,
         ETHSwap
    }

    struct VoteProposal {
        uint256 id;
        address proposer;
        Type voteType;
        uint256 tokenVoteQuantity;
        string voteProposalText;
        Status voteStatus;
        uint256 voteStarts;
        uint256 voteends;
        address receiver;
        address tokenID;
        uint256 amount;
    }

    //mappings
    mapping(address => Wave) internal proposalAttributes;
    mapping(address => uint256) public claimtimer; //timer for claiming Tokens.

    // this is related to voting
    uint256[] internal findVoteId;

    mapping(uint256 => VoteProposal) internal voteProposalAttributes;
    mapping(uint256 => mapping(address => bool)) internal votingStatus;

    mapping(uint256 => uint256) internal NumTokenFor;
    mapping(uint256 => uint256) internal NumTokenAgainst;
    mapping(uint256 => uint256) public VotersLeft;

    //This is related to NFT Splitting
    mapping (address => mapping(uint => bool)) public wasDistributed; 

    //Events Related to Staking of ETH 

    event AddStake(
        address indexed from,
        address indexed to,
        uint256 timestamp,
        uint256 amount
    ); 

    //Events related to changes in voting procedures

    event VoteStatus(
        uint256 indexed id,
        address sender,
        Status voteStatus,
        uint256 timestamp
    );

    //This is initializer function that is run once the proxy is created
    function initialize(
        address _addressWaveContract,
        MinimalForwarderUpgradeable _Forwarder,
        IUniswapRouter _swapRouter,
        uint256 id,
        address _waver,
        address _proposed,
        uint256 _marryDate

    ) public initializer {
        __ERC2771Context_init(address(_Forwarder));
        voteid += 1;
        addressWaveContract = _addressWaveContract;
        MarriageStatus = 1;
        //maybe need to send it to the main contract... 

        proposalAttributes[_waver] = proposalAttributes[_proposed] = Wave({
            id: id,
            waver: _waver,
            proposed: _proposed
        });
        swapRouter = _swapRouter;
        MarryDate = _marryDate;
      
        familyMembers = 2;
        forwarderAddr = address(_Forwarder);
    }

    //Check whether msgSender belongs to this contract
    function checkAuth(address msgSender) internal view returns (Wave storage) {
        Wave storage waver = proposalAttributes[msgSender];
        require(waver.id > 0, "Not Auth");
        return (waver);
    }

   
    //User creates proposals within the contract and each family member votes for it.
    function createProposal(
        string memory _message,
        Type _votetype,
        uint256 _voteends,
        uint256 _votestarts,
        uint256 _numTokens,
        address payable _receiver,
        address _tokenID,
        uint256 _amount,
        uint256 txfee
    ) external {

        address msgSender_ = _msgSender();
        Wave storage waver = checkAuth(msgSender_);
        
        require(MarriageStatus == 1);

        if (_votestarts < block.timestamp) {
            _votestarts = block.timestamp;
        }

        
        WaverContract _wavercContract = WaverContract(addressWaveContract);
        uint256 policyDays = _wavercContract.policyDays();
       
        if (_votetype == Type.Divorce) {
            require(
                MarryDate + policyDays < block.timestamp
            );
            require(waver.proposed == msgSender_ || waver.waver == msgSender_);
        }

        findVoteId.push(voteid);

        voteProposalAttributes[voteid] = VoteProposal({
            id: voteid,
            proposer: msgSender_,
            voteType: _votetype,
            tokenVoteQuantity: _numTokens,
            voteProposalText: _message,
            voteStatus: Status.Proposed,
            voteends: _voteends,
            voteStarts: _votestarts,
            receiver: _receiver,
            tokenID: _tokenID,
            amount: _amount
        });

        NumTokenFor[voteid] = _numTokens;
        NumTokenAgainst[voteid] = 0;

        VotersLeft[voteid] = familyMembers - 1;
        votingStatus[voteid][msgSender_] = true;

        _wavercContract.burn(msgSender_, _numTokens);

        //A service fee to keep tx.fees free for users
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(voteid, msgSender_, Status.Proposed, block.timestamp);
        voteid += 1;
    }

    //Family members respond to proposals through this function
    function voteResponse(
        uint256 _id,
        uint256 _numTokens,
        uint8 responsetype,
        uint256 txfee
    ) external {
        address msgSender_ = _msgSender();
        checkAuth(msgSender_);

        require(votingStatus[_id][msgSender_] != true);
        
        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        WaverContract _wavercContract = WaverContract(addressWaveContract);
        require(voteProposal.voteStatus == Status.Proposed);
        /*require (voteProposal.voteStarts<block.timestamp,"Not passed");
        require(
            _numTokens < _wavercContract.balanceOf(msgSender_)
        ); */

        _wavercContract.burn(msgSender_, _numTokens);
        
        VotersLeft[_id] -= 1;

        if (responsetype == 2) {
            NumTokenFor[_id] += _numTokens;
        } else {
            NumTokenAgainst[_id] += _numTokens;
        }
        
        if (VotersLeft[_id] == 0) {
            if (NumTokenFor[_id] <= NumTokenAgainst[_id]) {
                voteProposal.voteStatus = Status.Declined;
            } else if (NumTokenFor[_id] > NumTokenAgainst[_id]) {
                voteProposal.voteStatus = Status.Accepted;
            }
        }

        votingStatus[_id][msgSender_] = true;

        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }

    //Votes can be cancelled
    function cancelVoting(uint256 _id, uint256 txfee) external {
        address msgSender_ = _msgSender();
        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        require(
            voteProposal.proposer == msgSender_ && voteProposal.voteStatus == Status.Proposed
        );
        voteProposal.voteStatus = Status.Cancelled;
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }

    //If deadline passes vote can be ended by date through this function
    function endVotingByTime(uint256 _id, uint256 txfee) external {
        address msgSender_ = _msgSender();
        checkAuth(msgSender_);
        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        require(
            voteProposal.voteStarts + voteProposal.voteends < block.timestamp
        );
        require(voteProposal.voteStatus == Status.Proposed);
        if (NumTokenFor[_id] <= NumTokenAgainst[_id]) {
            voteProposal.voteStatus = Status.Declined;
        } else if (NumTokenFor[_id] > NumTokenAgainst[_id]) {
            voteProposal.voteStatus = Status.Accepted;
        }
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }

    //Votes can be executed through this function
function executeVoting(uint256 _id, uint256 txfee, uint256 _oracleprice)
        external
        nonReentrant
    {
        require(MarriageStatus == 1);
        address msgSender_ = _msgSender();
        Wave storage waver = checkAuth(msgSender_);
       
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }

        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        require(voteProposal.voteStatus == Status.Accepted);

        WaverContract _wavercContract = WaverContract(
                    addressWaveContract
                );

        uint256 _amount = voteProposal.amount * 99/100;


        //If vote passes this makes transfers from the contract. 
        if (voteProposal.voteType == Type.TransferETH) {
            processtxn(payable(addressWaveContract), voteProposal.amount / 100);
                
                processtxn(
                    payable(voteProposal.receiver),
                    _amount 
                );
                
            voteProposal.voteStatus = Status.Paid;

        } 
        
        else if (voteProposal.voteType == Type.TransferERC20) {
                require(
                    transferToken(
                        voteProposal.tokenID,
                        payable(voteProposal.receiver),
                        _amount
                    )
                );
                
         
            voteProposal.voteStatus = Status.Paid;
        }
        //This is if two sides decide to divorce, funds are split between partners
       else if (voteProposal.voteType == Type.Divorce) {
            MarriageStatus = 2;

            processtxn(
                payable(addressWaveContract),
                address(this).balance / 100
            );

            uint256 splitamount = address(this).balance / 2;
            processtxn(payable(waver.waver), splitamount);
            processtxn(payable(waver.proposed), splitamount);
           
            
            
           _wavercContract.divorceUpdate(waver.id);
          
            voteProposal.voteStatus = Status.Divorced;

        }  else if (voteProposal.voteType == Type.TransferNFT) {
       
        IERC721(voteProposal.tokenID).safeTransferFrom(address(this),voteProposal.receiver, voteProposal.amount);
        voteProposal.voteStatus = Status.NFTsent;

        } 
    
        else if (voteProposal.voteType == Type.InvestETH){
           

                CEth cToken = CEth(voteProposal.receiver);
                cToken.mint{ value: _amount}();
               
                 voteProposal.voteStatus = Status.Invested;
            } else if (voteProposal.voteType == Type.InvestERC20){
                 require(
                    transferToken(
                        voteProposal.tokenID,
                        payable(addressWaveContract),
                        voteProposal.amount / 100
                    )
                );
           
                CErc20 cToken = CErc20(voteProposal.receiver);
                IERC20Upgradeable(voteProposal.tokenID).approve(voteProposal.receiver,_amount);
                cToken.mint(_amount);
                 voteProposal.voteStatus = Status.Invested;

            } 
            
            else if (voteProposal.voteType == Type.RedeemETH){
                require(
                    transferToken(
                        voteProposal.tokenID,
                        payable(addressWaveContract),
                        voteProposal.amount / 100
                    )
                   
                );

                CEth cToken = CEth(voteProposal.receiver);
                cToken.redeem(_amount); 
                voteProposal.voteStatus = Status.Redeemed;
                
                } 
                
                else if (voteProposal.voteType == Type.RedeemERC20){
                require(
                    transferToken(
                        voteProposal.tokenID,
                        payable(addressWaveContract),
                        voteProposal.amount / 100
                    )
                );

                CErc20 cToken = CErc20(voteProposal.receiver);
                cToken.redeem(_amount);
                voteProposal.voteStatus = Status.Redeemed;
                }

          else if (voteProposal.voteType == Type.ERC20Swap){
            require(
                    transferToken(
                        voteProposal.tokenID,
                        payable(addressWaveContract),
                        voteProposal.amount / 100
                    )
                );
           
            
            uint24 poolFee = _wavercContract.poolFee();

            TransferHelper.safeApprove(voteProposal.tokenID, address(swapRouter), _amount);
            
            ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: voteProposal.tokenID,
                tokenOut: voteProposal.receiver,
                fee: poolFee,
                recipient: address(this),
                deadline: voteProposal.voteStarts + voteProposal.voteends,
                amountIn: _amount,
                amountOutMinimum: _oracleprice,
                sqrtPriceLimitX96: 0
            });

            swapRouter.exactInputSingle(params);
            voteProposal.voteStatus = Status.SwapSubmitted;

        } 
        
        else if (voteProposal.voteType == Type.ETHSwap){
           
            processtxn(payable(addressWaveContract), voteProposal.amount / 100);
            
          
            
            uint24 poolFee = _wavercContract.poolFee();

            ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: voteProposal.tokenID,
                tokenOut: voteProposal.receiver,
                fee: poolFee,
                recipient: address(this),
                deadline: voteProposal.voteStarts + voteProposal.voteends,
                amountIn: _amount,
                amountOutMinimum: _oracleprice,
                sqrtPriceLimitX96: 0
            });

            swapRouter.exactInputSingle{ value: voteProposal.amount }(params);
            swapRouter.refundETH();
            voteProposal.voteStatus = Status.SwapSubmitted;

        }
        else {
             revert();
        }
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }



    //This is how  new family members are added/deleted. Can be called by main partners of the marriage
    function addFamilyMember(address _member, uint256 txfee) external {
        address msgSender_ = _msgSender();
        Wave storage waver = checkAuth(msgSender_);
        require(waver.waver == msgSender_ || waver.proposed == msgSender_);
        require(waver.waver != _member && waver.proposed != _member);
        WaverContract _waverContract = WaverContract(addressWaveContract);
        _waverContract.addFamilyMember(_member, waver.id);
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(0, msgSender_, Status.FamilyAdded, block.timestamp);
    }

    function _addFamilyMember (address _member, address _owner ) external {
        require(addressWaveContract == msg.sender);
        proposalAttributes[_member] = proposalAttributes[_owner];
        familyMembers += 1;
    }


    function deleteFamilyMember(address _member, uint256 txfee) external {
        address msgSender_ = _msgSender();
        Wave storage waver = checkAuth(msgSender_);
        require(waver.waver == msgSender_ || waver.proposed == msgSender_);
        require(waver.waver != _member && waver.proposed != _member);
        WaverContract _waverContract = WaverContract(addressWaveContract);
        delete proposalAttributes[_member];
        familyMembers -= 1;
        _waverContract.deleteFamilyMember(_member);
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(0, msgSender_, Status.FamilyDeleted, block.timestamp);
    }

    //If partners are divorced they can also split their ERC20 assets
    function withdrawERC20(address _tokenID) external {
        address msgSender_ = _msgSender();
        require(MarriageStatus == 2);
        Wave storage waver = checkAuth(msgSender_);
        uint256 amount;
        amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));
        require(
            transferToken(_tokenID, payable(addressWaveContract), amount / 100)
        );
        amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));
        require(
            transferToken(_tokenID, payable(waver.waver), (amount / 2))
        );
        require(
            transferToken(_tokenID, payable(waver.proposed), (amount / 2))
        );
    }

    function checkOwnership (address _nft_Address, uint256 _tokenID) internal  view returns (bool){
            address _owner; 
            _owner = IERC721(_nft_Address).ownerOf(_tokenID);
            if (address(this) == _owner) { return true;}
            else {return false;}
            }

    function SplitNFT (address _tokenAddr, uint _tokenID, string memory nft_json1, string memory nft_json2 ) external {
        require(MarriageStatus == 2);
        address msgSender_ = _msgSender();
        Wave storage waver = checkAuth(msgSender_);

        require (wasDistributed[_tokenAddr][_tokenID] == false);
        require (checkOwnership(_tokenAddr,_tokenID) == true);    
     
         WaverContract _wavercContract = WaverContract(addressWaveContract);
         address nftSplitAddr = _wavercContract.addressNFTSplit();

         nftSplitInstance nftSplit = nftSplitInstance(nftSplitAddr);
         nftSplit.splitNFT(_tokenAddr, _tokenID, nft_json1, nft_json2, waver.waver, waver.proposed, address(this));
         wasDistributed[_tokenAddr][_tokenID] == true; 

    }

function sendNft (address nft_address, address receipent, uint nft_ID  ) external {
     WaverContract _wavercContract = WaverContract(addressWaveContract);
    require (_wavercContract.addressNFTSplit() == msg.sender);
     IERC721(nft_address).safeTransferFrom(address(this),receipent, nft_ID);

}

    //These functions are called to load all votings

    function getVoteLength() external view returns (uint256) {
        return findVoteId.length;
    }

    function getVotingStatuses(uint256 _pagenumber)
        external
        view
        returns (VoteProposal[] memory)
    {
        checkAuth(msg.sender);
        uint256 page = findVoteId.length / 20;
        uint256 size;
        uint256 start;
        if (_pagenumber * 20 > findVoteId.length) {
            size = findVoteId.length % 20;
            if (size == 0) {
                size = 20;
                page -= 1;
            }
            start = page * 20;
        } else if (_pagenumber * 20 <= findVoteId.length) {
            size = 20;
            start = (_pagenumber - 1) * 20;
        }

        VoteProposal[] memory votings = new VoteProposal[](size);

        for (uint256 i = 0; i < size; i++) {
            votings[i] = voteProposalAttributes[findVoteId[start + i]];
        }
        return votings;
    }

    //These function used to claim LOVE tokens on periodic basis

    function claimToken(uint256 txfee) external {
        require(MarriageStatus == 1);
        address msgSender_ = _msgSender();
        checkAuth(msgSender_);
        WaverContract _wavercContract = WaverContract(addressWaveContract);
        uint256 policyDays = _wavercContract.policyDays();

        require(claimtimer[msgSender_] + policyDays < block.timestamp);

        uint256 amount = (address(this).balance * 10) / familyMembers;
        claimtimer[msgSender_] = block.timestamp;
        _wavercContract.mint(msgSender_, amount);
        if (msg.sender == forwarderAddr) {
            processtxn(payable(addressWaveContract), txfee);
        }
        emit VoteStatus(0, msgSender_, Status.Tokenclaimed, block.timestamp);
    }

    //done
    function addstake() external payable {
        require(MarriageStatus == 1);
        processtxn(payable(addressWaveContract), (msg.value) / 100);
        emit AddStake(msg.sender, address(this), block.timestamp, msg.value);
    }

    function processtxn(address payable _to, uint256 _amount) internal {
        (bool success, ) = _to.call{value: _amount}("");
        require(success);
        emit AddStake(address(this), _to, block.timestamp, _amount);
    }

    receive() external payable {
        require(msg.value > 0);
        require(MarriageStatus == 1);
        processtxn(payable(addressWaveContract), (msg.value ) / 100);
        emit AddStake(msg.sender, address(this), block.timestamp, msg.value);
    }
}
