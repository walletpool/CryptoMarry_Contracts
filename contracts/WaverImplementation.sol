// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/MinimalForwarderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "./SecuredTokenTransfer.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

pragma abicoder v2;

/**
 [MIT License]
 @title CM Proxy contract implementation.
 @notice Individual contract is created after proposal has been sent to the partner. 
 ETH stake will be deposited to this newly created 
 contract. 
 @author Ismailov Altynbek <altyni@gmail.com>
*/

/*Interface for the Main Contract*/
interface WaverContract {
    function burn(address _to, uint256 _amount) external;

    function policyDays() external returns (uint256);

    function addFamilyMember(address, uint256) external;

    function cancel(uint256) external;

    function deleteFamilyMember(address) external;

    function divorceUpdate(uint256 _id) external;

    function addressNFTSplit() external returns (address);

    function poolFee() external returns (uint24);
}

/*Interface for the NFT Split Contract*/

interface nftSplitInstance {
    function splitNFT(
        address _nft_Address,
        uint256 _tokenID,
        string memory nft_json1,
        string memory nft_json2,
        address waver,
        address proposed,
        address _implementationAddr
    ) external;
}

/*Interface for the CERC20 (Compound) Contract*/
interface CErc20 {
    function mint(uint256) external returns (uint256);

    function redeem(uint256) external returns (uint256);
}

/*Interface for the CETH (Compound)  Contract*/
interface CEth {
    function mint() external payable;

    function redeem(uint256) external returns (uint256);
}

/*Interface for the ISWAP Router (Uniswap)  Contract*/
interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

contract WaverImplementation is
    Initializable,
    ReentrancyGuardUpgradeable,
    ERC2771ContextUpgradeable,
    SecuredTokenTransfer,
    ERC721HolderUpgradeable
{
    /* Variables*/
    uint256 internal voteid; //Tracking voting proposals by VOTEID
    uint256 public familyMembers; //Number of family Members within this contract. Initially 2
    uint256 public marryDate; //Date when the proposal has been accepted.
    address payable internal addressWaveContract; //Address for the main contract

    /* Uniswap Router Address with interface*/

    IUniswapRouter internal swapRouter;

    /* Status of the Marriage Contract*/

    MarriageStatus public marriageStatus;

    /* Properties of the Marriage Contract*/
    Wave internal props;

    /* Structs*/
    /* Marriage Props*/
    struct Wave {
        uint256 id;
        address proposer;
        address proposed;
        uint256 cmFee;
    }

    /* Voting Props*/
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
        uint256 votersLeft;
    }
    /* Enum Statuses of Voting proposals*/
    enum Status {
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
        FamilyDeleted
    }

    /* Enum Statuses of Voting Type*/
    enum Type {
        notProposed, //0
        simpleVote, //1
        TransferERC20, //2
        TransferETH, //3
        Divorce, //4
        TransferNFT, //5
        InvestETH, //6
        InvestERC20, //7
        RedeemETH, //8
        RedeemERC20, //9
        ERC20Swap, //10
        ETHSwap //11
    }

    /* Enum Statuses of the Marriage*/
    enum MarriageStatus {
        Proposed,
        Declined,
        Cancelled,
        Married,
        Divorced
    }

    /* Mappings*/

    mapping(address => bool) internal hasAccess; //Addresses that are alowed to use Proxy contract
    mapping(uint256 => VoteProposal) internal voteProposalAttributes; //Storage of voting proposals
    mapping(uint256 => mapping(address => bool)) internal votingStatus; // Tracking whether address has voted for particular voteid
    mapping(uint256 => uint256) internal numTokenFor; //Number of tokens voted for the proposal
    mapping(uint256 => uint256) internal numTokenAgainst; //Number of tokens voted against the proposal
    mapping(address => mapping(uint256 => uint8)) public wasDistributed; //Tracking whether NFT has been distributed between partners upon divorce

    /* Events*/

    /* Listening to whether ETH has been received/sent from the contract*/
    event AddStake(
        address indexed from,
        address indexed to,
        uint256 timestamp,
        uint256 amount
    );

    /* Listening to the changes of the voting statuses*/

    event VoteStatus(
        uint256 indexed id,
        address sender,
        Status voteStatus,
        uint256 timestamp
    );


 constructor(MinimalForwarderUpgradeable forwarder) initializer ERC2771ContextUpgradeable(address(forwarder)) {}
    /**
     * @notice Initialization function of the proxy contract
     * @dev Initialization params are passed from the main contract.
     * @param _addressWaveContract Address of the main contract.
     * @param _swapRouter Address of the Uniswap Router.
     * @param _id Marriage ID assigned by the main contract.
     * @param _proposer Address of the prpoposer.
     * @param _proposer Address of the proposed.
     * @param _cmFee CM fee, as a small percentage of incoming and outgoing transactions.
     */

    function initialize(
        address payable _addressWaveContract,
        IUniswapRouter _swapRouter,
        uint256 _id,
        address _proposer,
        address _proposed,
        uint256 _cmFee
    ) public initializer  {
       // __ERC2771Context_init(address(_Forwarder));
        unchecked{
         ++voteid;}
        addressWaveContract = _addressWaveContract;
        marriageStatus = MarriageStatus.Proposed;
        hasAccess[_proposer] = true;

        props = Wave({
            id: _id,
            proposer: _proposer,
            proposed: _proposed,
            cmFee: _cmFee
        });
        swapRouter = _swapRouter;
    }

    /* modifier that gives access to the contract's methods*/

    modifier onlyAccess() {
        require(hasAccess[_msgSender()] == true);
        _;
    }

    /* modifier that checks the address of the main contract*/

    modifier onlyContract() {
        require(addressWaveContract == msg.sender);
        _;
    }

    /**
     *@notice Proposer can cancel access to the contract if response has not been reveived or accepted. 
      The ETH balance of the contract will be sent to the proposer.   
     *@dev Once trigerred the access to the proxy contract will not be possible from the CM Frontend. Access is preserved 
     from the custom fronted such as Remix.   
     */

    function cancel() external onlyAccess {
        require(
            marriageStatus == MarriageStatus.Proposed ||
                marriageStatus == MarriageStatus.Declined
        );
        marriageStatus = MarriageStatus.Cancelled;
        WaverContract _wavercContract = WaverContract(addressWaveContract);
        _wavercContract.cancel(props.id);
        processtxn(
            addressWaveContract,
            (address(this).balance * props.cmFee) / 10000
        );
        processtxn(payable(props.proposer), address(this).balance);
    }

    /**
     *@notice If the proposal is accepted, triggers this function to be added to the proxy contract.
     *@dev this function is called from the Main Contract.
     */

    function agreed() external onlyContract {
        marriageStatus = MarriageStatus.Married;
        marryDate = block.timestamp;
        hasAccess[props.proposed] = true;
        familyMembers = 2;
    }

    /**
     *@notice If the proposal is declined, the status is changed accordingly.
     *@dev this function is called from the Main Contract.
     */

    function declined() external onlyContract {
        marriageStatus = MarriageStatus.Declined;
    }

    /**
     * @notice This method allows to add stake to the contract.
     * @dev it is required that the marriage status is proper, since the funds will be locked if otherwise.
     */

    function addstake() external payable {
        require(marriageStatus != MarriageStatus.Divorced);
        processtxn(addressWaveContract, ((msg.value) * props.cmFee) / 10000);
        emit AddStake(msg.sender, address(this), block.timestamp, msg.value);
    }

    /** Methods related to voting */

    /**
     * @notice Through this method proposals for voting is created. 
     * @dev All params are required. tokenID for the native currency is 0x0 address. To create proposals it is necessary to 
     have LOVE tokens as it will be used as backing of the proposal. 
     * @param _message String text on details of the proposal. 
     * @param _votetype Type of the proposal as it was listed in enum above. 
     * @param _voteends Timestamp on when the voting ends
     * @param _votestarts Timestamp on when the voting starts
     * @param _numTokens Number of LOVE tokens that is used to back this proposal. 
     * @param _receiver Address of the receiver who will be receiving indicated amounts. 
     * @param _tokenID Address of the ERC20, ERC721 or other tokens. 
     * @param _amount The amount of token that is being sent. Alternatively can be used as NFT ID. 
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without balance through 
     Minimal Forwarder.
     */

    function createProposal(
        string calldata _message,
        Type _votetype,
        uint256 _voteends,
        uint256 _votestarts,
        uint256 _numTokens,
        address payable _receiver,
        address _tokenID,
        uint256 _amount,
        uint256 txfee
    ) external onlyAccess {
        address msgSender_ = _msgSender();
        require(marriageStatus == MarriageStatus.Married);

        if (_voteends< 10 minutes ) {
            _voteends= 10 minutes;
        }

        if (_votestarts < block.timestamp) {
            _votestarts = block.timestamp;
        }

        WaverContract _wavercContract = WaverContract(addressWaveContract);

        if (_votetype == Type.Divorce) {
            //Cooldown has to pass before divorce is proposed.
            uint256 policyDays = _wavercContract.policyDays();
            require(marryDate + policyDays < block.timestamp);
            //Only partners can propose divorce
            require(
                props.proposed == msgSender_ || props.proposer == msgSender_
            );
        }

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
            amount: _amount,
            votersLeft: familyMembers - 1
        });

        numTokenFor[voteid] = _numTokens;

        votingStatus[voteid][msgSender_] = true;

        _wavercContract.burn(msgSender_, _numTokens);

        checkForwarder(txfee);
        emit VoteStatus(voteid, msgSender_, Status.Proposed, block.timestamp);
        unchecked{
         ++voteid;}
    }

    /**
     * @notice Through this method, proposals are voted for/against.  
     * @dev A user cannot vote twice. User cannot vote on voting which has been already passed/declined. Token staked is burnt.
     There is no explicit ways of identifying votes for or against the vote. 
     * @param _id Vote ID, that is being voted for/against. 
     * @param _numTokens Number of LOVE tokens that is being backed within the vote. 
     * @param responsetype Voting response for/against
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without balance through 
     */

    function voteResponse(
        uint256 _id,
        uint256 _numTokens,
        uint8 responsetype,
        uint256 txfee
    ) external onlyAccess {
        address msgSender_ = _msgSender();

        require(votingStatus[_id][msgSender_] != true);
        votingStatus[_id][msgSender_] = true;

        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        WaverContract _wavercContract = WaverContract(addressWaveContract);
        require(voteProposal.voteStatus == Status.Proposed);

        voteProposal.votersLeft -= 1;

        if (responsetype == 2) {
            numTokenFor[_id] += _numTokens;
        } else {
            numTokenAgainst[_id] += _numTokens;
        }

        if (voteProposal.votersLeft == 0) {
            if (numTokenFor[_id] < numTokenAgainst[_id]) {
                voteProposal.voteStatus = Status.Declined;
            } else {
                voteProposal.voteStatus = Status.Accepted;
            }
        }

        _wavercContract.burn(msgSender_, _numTokens);

        checkForwarder(txfee);
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }

    /**
     * @notice If the proposal has been passed, depending on vote type, the proposal is executed.
     * @dev  Two external protocols are used Uniswap and Compound.
     * @param _id Vote ID, that is being voted for/against.
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without balance through
     * @param _oracleprice This param is used by Uniswap. It is feeded by offchain oracle for price of swapping pair.
     */

    function executeVoting(
        uint256 _id,
        uint256 txfee,
        uint256 _oracleprice
    ) external nonReentrant onlyAccess {
        require(marriageStatus == MarriageStatus.Married);
        address msgSender_ = _msgSender();

        checkForwarder(txfee);

        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        require(voteProposal.voteStatus == Status.Accepted);

        WaverContract _wavercContract = WaverContract(addressWaveContract);

        //A small fee for the protocol is deducted here
        uint256 _amount = (voteProposal.amount * (10000 - props.cmFee)) / 10000;
        uint256 _cmfees = voteProposal.amount - _amount;

        // Sending ETH from the contract
        if (voteProposal.voteType == Type.TransferETH) {
            processtxn(addressWaveContract, _cmfees);

            processtxn(payable(voteProposal.receiver), _amount);

            voteProposal.voteStatus = Status.Paid;
        }
        //Sending ERC20 tokens owned by the contract
        else if (voteProposal.voteType == Type.TransferERC20) {
            require(
                transferToken(
                    voteProposal.tokenID,
                    addressWaveContract,
                    _cmfees
                )
            );
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
            marriageStatus = MarriageStatus.Divorced;

            processtxn(
                addressWaveContract,
                (address(this).balance * props.cmFee) / 10000
            );

            uint256 splitamount = address(this).balance / 2;
            processtxn(payable(props.proposer), splitamount);
            processtxn(payable(props.proposed), splitamount);

            _wavercContract.divorceUpdate(props.id);

            voteProposal.voteStatus = Status.Divorced;

            //Sending ERC721 tokens owned by the contract
        } else if (voteProposal.voteType == Type.TransferNFT) {
            IERC721(voteProposal.tokenID).safeTransferFrom(
                address(this),
                voteProposal.receiver,
                voteProposal.amount
            );
            voteProposal.voteStatus = Status.NFTsent;
        }
        //Staking ETH to the Compound protocol. cETH token is recieved.
        else if (voteProposal.voteType == Type.InvestETH) {
            processtxn(addressWaveContract, _cmfees);

            CEth cToken = CEth(voteProposal.receiver);
            cToken.mint{value: _amount}();

            voteProposal.voteStatus = Status.Invested;

            //Staking ERC20 token to the Compound protocol. Corresponding cToken is recieved.
        } else if (voteProposal.voteType == Type.InvestERC20) {
            require(
                transferToken(
                    voteProposal.tokenID,
                    addressWaveContract,
                    _cmfees
                )
            );

            CErc20 cToken = CErc20(voteProposal.receiver);

            TransferHelper.safeApprove(
                voteProposal.tokenID,
                voteProposal.receiver,
                _amount
            );

            cToken.mint(_amount);
            voteProposal.voteStatus = Status.Invested;
        }
        // Redeeming cETH token, for ETH.
        else if (voteProposal.voteType == Type.RedeemETH) {
            require(
                transferToken(
                    voteProposal.tokenID,
                    addressWaveContract,
                    _cmfees
                )
            );

            CEth cEther = CEth(voteProposal.receiver);

            cEther.redeem(_amount);
            voteProposal.voteStatus = Status.Redeemed;
        }
        // Redeeming cToken for corresponding ERC20 token.
        else if (voteProposal.voteType == Type.RedeemERC20) {
            require(
                transferToken(
                    voteProposal.tokenID,
                    addressWaveContract,
                    _cmfees
                )
            );

            CErc20 cToken = CErc20(voteProposal.receiver);

            cToken.redeem(_amount);
            voteProposal.voteStatus = Status.Redeemed;
        }
        //Swapping ERC20 token for other ERC20token.
        else if (voteProposal.voteType == Type.ERC20Swap) {
            require(
                transferToken(
                    voteProposal.tokenID,
                    addressWaveContract,
                    _cmfees
                )
            );

            uint24 poolFee = _wavercContract.poolFee();

            TransferHelper.safeApprove(
                voteProposal.tokenID,
                address(swapRouter),
                _amount
            );

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: voteProposal.tokenID,
                    tokenOut: voteProposal.receiver,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: voteProposal.voteStarts + 30 days,
                    amountIn: _amount,
                    amountOutMinimum: _oracleprice,
                    sqrtPriceLimitX96: 0
                });

            swapRouter.exactInputSingle(params);
            voteProposal.voteStatus = Status.SwapSubmitted;
        }
        //Swapping ETH for other ERC20 token. Swapping ERC20 back will receive WETH token.
        else if (voteProposal.voteType == Type.ETHSwap) {
            processtxn(addressWaveContract, _cmfees);

            uint24 poolFee = _wavercContract.poolFee();

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
                .ExactInputSingleParams({
                    tokenIn: voteProposal.tokenID,
                    tokenOut: voteProposal.receiver,
                    fee: poolFee,
                    recipient: address(this),
                    deadline: voteProposal.voteStarts + 30 days,
                    amountIn: _amount,
                    amountOutMinimum: _oracleprice,
                    sqrtPriceLimitX96: 0
                });

            swapRouter.exactInputSingle{value: _amount}(params);

            swapRouter.refundETH();

            voteProposal.voteStatus = Status.SwapSubmitted;
        } else {
            revert();
        }
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }

    /**
     * @notice The vote can be cancelled by the proposer if it has not been passed.
     * @dev once cancelled the proposal cannot be voted or executed.
     * @param _id Vote ID, that is being voted for/against.
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without balance through
     */

    function cancelVoting(uint256 _id, uint256 txfee) external {
        address msgSender_ = _msgSender();
        checkForwarder(txfee);
        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        require(
            voteProposal.proposer == msgSender_ &&
                voteProposal.voteStatus == Status.Proposed
        );
        voteProposal.voteStatus = Status.Cancelled;
        
        emit VoteStatus(
            _id,
            msgSender_,
            voteProposal.voteStatus,
            block.timestamp
        );
    }

     /**
     * @notice Function to reimburse transactions costs of relayers 
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without balance through
     */

    function checkForwarder(uint txfee) internal {
    if (isTrustedForwarder(msg.sender)) {
            processtxn(addressWaveContract, txfee);
        }

    }

    /**
     * @notice The vote can be processed if deadline has been passed.
     * @dev voteend is compounded. The status of the vote proposal depends on number of Tokens voted for/against.
     * @param _id Vote ID, that is being voted for/against.
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without balance through
     */

    function endVotingByTime(uint256 _id, uint256 txfee) external onlyAccess {
        VoteProposal storage voteProposal = voteProposalAttributes[_id];
        require(
            voteProposal.voteStarts + voteProposal.voteends < block.timestamp
        );
        require(voteProposal.voteStatus == Status.Proposed);
        if (numTokenFor[_id] < numTokenAgainst[_id]) {
            voteProposal.voteStatus = Status.Declined;
        } else {
            voteProposal.voteStatus = Status.Accepted;
        }
       checkForwarder(txfee);
        emit VoteStatus(
            _id,
            _msgSender(),
            voteProposal.voteStatus,
            block.timestamp
        );
    }

    /* Managing family members*/

    function checkPartner(address _member)
        internal
        view
        returns (address msgSender__)
    {
        address msgSender_ = _msgSender();
        require(props.proposer == msgSender_ || props.proposed == msgSender_);
        require(props.proposer != _member && props.proposed != _member);
        return msgSender_;
    }

    /**
     * @notice Through this method a family member can be invited. Once added, the user needs to accept invitation.
     * @dev Only partners can add new family member. Partners cannot add their current addresses.
     * @param _member The address who are being invited to the proxy.
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without ETH balance.
     */

    function addFamilyMember(address _member, uint256 txfee)
        external
    {
        address msgSender_ = checkPartner(_member);
        require(marriageStatus == MarriageStatus.Married);

        require(familyMembers < 50);
        WaverContract _waverContract = WaverContract(addressWaveContract);
        _waverContract.addFamilyMember(_member, props.id);
        checkForwarder(txfee);
        emit VoteStatus(0, msgSender_, Status.FamilyAdded, block.timestamp);
    }

    /**
     * @notice Through this method a family member is added once invitation is accepted.
     * @dev This method is called by the main contract.
     * @param _member The address that is being added.
     */

    function _addFamilyMember(address _member) external onlyContract {
        hasAccess[_member] = true;
        familyMembers += 1;
    }

    /**
     * @notice Through this method a family member can be deleted. Member can be deleted by partners or by the members own address.
     * @dev Member looses access and will not be able to access to the proxy contract from the front end. Member address cannot be that of partners'.
     * @param _member The address who are being deleted.
     * @param txfee Transaction fee that is deducted from the contract, if user used this method without ETH balance.
     */

    function deleteFamilyMember(address _member, uint256 txfee)
        external
    {
        address msgSender_ = checkPartner(_member);

        WaverContract _waverContract = WaverContract(addressWaveContract);

        _waverContract.deleteFamilyMember(_member);
        delete hasAccess[_member];
        familyMembers -= 1;

        checkForwarder(txfee);
        emit VoteStatus(0, msgSender_, Status.FamilyDeleted, block.timestamp);
    }

    /* Divorce settlement. Once Divorce is processed there are 
    other assets that have to be split*/

    /**
     * @notice Once divorced, partners can split ERC20 tokens owned by the proxy contract.
     * @dev Each partner/or other family member can call this function to transfer ERC20 to respective wallets.
     * @param _tokenID the address of the ERC20 token that is being split.
     */

    function withdrawERC20(address _tokenID) external onlyAccess {
        require(marriageStatus == MarriageStatus.Divorced);
        uint256 amount;
        amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));

        require(
            transferToken(
                _tokenID,
                addressWaveContract,
                (amount * props.cmFee) / 10000
            )
        );
        amount = IERC20Upgradeable(_tokenID).balanceOf(address(this));

        require(transferToken(_tokenID, props.proposer, (amount / 2)));

        require(transferToken(_tokenID, props.proposed, (amount / 2)));
    }

    /**
     * @notice Once divorced, partners can split ERC721 tokens owned by the proxy contract. 
     * @dev Each partner/or other family member can call this function to split ERC721 token between partners.
     Two identical copies of ERC721 will be created by the NFT Splitter contract creating a new ERC1155 token.
      The token will be marked as "Copy". 
     To retreive the original copy, the owner needs to have both copies of the NFT. 

     * @param _tokenAddr the address of the ERC721 token that is being split. 
     * @param _tokenID the ID of the ERC721 token that is being split
     * @param nft_json1 metadata of the ERC721.  
     * @param nft_json2 metadata of the ERC721 part 2.  
     */

    function SplitNFT(
        address _tokenAddr,
        uint256 _tokenID,
        string memory nft_json1,
        string memory nft_json2
    ) external onlyAccess {
        require(marriageStatus == MarriageStatus.Divorced);

        require(wasDistributed[_tokenAddr][_tokenID] == 0); //ERC721 Token should not be split before
        require(checkOwnership(_tokenAddr, _tokenID) == true); // Check whether the indicated token is owned by the proxy contract.

        WaverContract _wavercContract = WaverContract(addressWaveContract);
        address nftSplitAddr = _wavercContract.addressNFTSplit(); //gets NFT splitter address from the pain contract

        nftSplitInstance nftSplit = nftSplitInstance(nftSplitAddr);
        wasDistributed[_tokenAddr][_tokenID] == 1; //Check and Effect
        nftSplit.splitNFT(
            _tokenAddr,
            _tokenID,
            nft_json1,
            nft_json2,
            props.proposer,
            props.proposed,
            address(this)
        ); //A copy of the NFT is created by NFT Splitter.
    }

    /**
     * @notice Checks the ownership of the ERC721 token.
     * @param _tokenAddr the address of the ERC721 token that is being split.
     * @param _tokenID the ID of the ERC721 token that is being split
     */

    function checkOwnership(address _tokenAddr, uint256 _tokenID)
        internal
        view
        returns (bool)
    {
        address _owner;
        _owner = IERC721(_tokenAddr).ownerOf(_tokenID);
        return (address(this) == _owner);
    }

    /**
     * @notice If partner acquires both copies of NFTs, the NFT can be redeemed by that partner through NFT Splitter contract. 
     NFT Splitter uses this function to implement transfer of the token.  
     * @param _tokenAddr the address of the ERC721 token that is being joined. 
     * @param _receipent the address of the ERC721 token that is being sent. 
     * @param _tokenID the ID of the ERC721 token that is being sent
     */

    function sendNft(
        address _tokenAddr,
        address _receipent,
        uint256 _tokenID
    ) external {
        WaverContract _wavercContract = WaverContract(addressWaveContract);
        require(_wavercContract.addressNFTSplit() == msg.sender);
        IERC721(_tokenAddr).safeTransferFrom(
            address(this),
            _receipent,
            _tokenID
        );
    }

    /**
     * @notice Internal function to process payments.
     * @dev call method is used to keep process gas limit higher than 2300. Amount of 0 will be skipped,
     * @param _to Address that will be reveiving payment
     * @param _amount the amount of payment
     */

    function processtxn(address payable _to, uint256 _amount) internal {
        if (_amount > 0) {
            (bool success, ) = _to.call{value: _amount}("");
            require(success);
            emit AddStake(address(this), _to, block.timestamp, _amount);
        }
    }

    /* Checking and Querying the voting data*/

    /* This view function returns how many votes has been created*/
    function getVoteLength() external view returns (uint256) {
        return voteid-1;
    }

    /**
     * @notice This function is used to query votings.  
     * @dev Since there is no limit for the number of voting proposals, the proposals are paginated. 
     Web queries page number to get voting statuses. Each page has 20 vote proposals. 
     * @param _pagenumber A page number queried.   
     */

    function getVotingStatuses(uint256 _pagenumber)
        external
        view
        onlyAccess
        returns (VoteProposal[] memory)
    {
        uint length =  voteid- 1;
        uint256 page = length / 20;
      
        uint256 size;
        uint256 start;
        if (_pagenumber * 20 > length) {
            size = length % 20;
            if (size == 0 && page != 0) {
                size = 20;
                page -= 1;
            }
            start = page * 20 +1;
        } else if (_pagenumber * 20 <= length) {
            size = 20;
            start = (_pagenumber - 1) * 20 +1; 
           
        }

        VoteProposal[] memory votings = new VoteProposal[](size);

        for (uint256 i = 0; i < size; i++) {
            votings[i] = voteProposalAttributes[start + i];
        }
        return votings;
    }

    /**
     * @notice A fallback function that receives native currency.
     * @dev It is required that the status is not divorced so that funds are not locked.
     */
    receive() external payable {
        require(marriageStatus != MarriageStatus.Divorced);
        require(msg.value > 0);
        if (gasleft() > 2300) {
            processtxn(addressWaveContract, (msg.value * props.cmFee) / 10000);
            emit AddStake(
                msg.sender,
                address(this),
                block.timestamp,
                msg.value
            );
        }
    }
}
