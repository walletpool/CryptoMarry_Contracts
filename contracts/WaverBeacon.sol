// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;
/// [MIT License]
/// @title Beacon contract 
/// @notice This contract assigns implementation of proxy contracts.  
/// @author Ismailov Altynbek <altyni@gmail.com>

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WaverBeacon is Ownable {

  UpgradeableBeacon immutable internal beacon; // Current address of the contract
   address public implementation; //Current Address of the implementation
  //address public waverImplementation;

/* @notice Address of the proxy implementation has to be passed to the Bacon
   @dev tx.origin is used once to transfer ownership to the deploying wallet  
*/

constructor(address _initWaverImplementation){
  beacon = new UpgradeableBeacon(_initWaverImplementation);
  implementation  = _initWaverImplementation;
  //waverImplementation=_initWaverImplementation;
  transferOwnership(tx.origin);
}


/* @notice Address of the new/upgraded implementation of the proxy.
   @dev New implementation will change the proxy contract.
   @param _newWaverImplementation New address of the implementation  
*/
function update(address _newWaverImplementation) onlyOwner public {
  beacon.upgradeTo(_newWaverImplementation);
  implementation = _newWaverImplementation;
  //waverImplementation=_newWaverImplementation;
} //Done

/**
function implementation() public view returns (address){
  return beacon.implementation();//impAddress;
} */

}