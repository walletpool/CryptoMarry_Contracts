// SPDX-License-Identifier: BSL
pragma solidity ^0.8.17;

import "./WaverImplementationDiamond.sol";

/// [BSL License]
/// @title Proxy contract factory.
/// @notice A proxy contracts are created through the main contract.
/// @author Ismailov Altynbek <altyni@gmail.com>

contract WaverFactory  {
    address public WaverContractAddress; //Address of the main contract
    address internal owner;
    /* Address of the proxy implementation has to be passed to the Factory*/
    constructor() {
        WaverContractAddress = msg.sender;
        owner = msg.sender;
    }

    /**
     * @notice changing the address of the main contract.
     * @param _mainContract the address of the main contract.
     */

    function changeAddress(address _mainContract) public {
        require(owner == msg.sender);
        WaverContractAddress = _mainContract;
    }

    /**
     * @notice A method for creating proxy contracts.   
     * @dev Only the main contract address can create proxy contracts. Beacon proxy is created with 
     the current implementation.   
     * @param id Marriage ID assigned by the main contract.
     * @param _waver Address of the prpoposer.
     * @param _proposed Address of the proposed.
     * @param _divideShare the share that will be divided among partners upon dissolution.
     */

    function newMarriage(
        bytes32 name,
        uint256 id,
        address _waver,
        address _proposed,
        uint256 _policyDays,
        uint256 _divideShare,
        uint256 _threshold
    ) public returns (address) {
        require(WaverContractAddress == msg.sender);

        address _newMarriage = getVaultAddress(id,_waver,_proposed,_policyDays,_divideShare,_threshold, name);
       
        new WaverIDiamond{salt: name}(
                    payable(msg.sender),
                    id,
                    _waver,
                    _proposed,
                    _policyDays,
                    _divideShare,
                    _threshold
                );
       
        return _newMarriage;
    }

      function getVaultAddress(
        uint256 _id,
        address _waver,
        address _proposed,
        uint256 _policyDays,
        uint256 _divideShare,
        uint256 _threshold,
        bytes32 salt
    ) public view returns (address vault) {
        // Compute `CREATE2` address of vault
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                keccak256(
                                    abi.encodePacked(
                                        type(WaverIDiamond).creationCode,
                                        abi.encode(
                                            payable(WaverContractAddress),
                                            _id,
                                            _waver,
                                            _proposed,
                                            _policyDays,
                                            _divideShare,
                                            _threshold
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            );
         }


}
