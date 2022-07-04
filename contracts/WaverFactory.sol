// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./WaverImplementation.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./WaverBeacon.sol";

/// [MIT License]
/// @title Factory contract to creat proxies  
/// @notice This utility contract to help create proxies contract 
/// @author Ismailov Altynbek <altyni@gmail.com>

contract WaverFactory is Ownable {

  //address for the logic contract
  WaverBeacon immutable thisWaverBeacon;
  address public WaverContractAddress;

  mapping (uint => address) public MarriageID;

  constructor(
    address _implementation
  ) {
    thisWaverBeacon = new WaverBeacon(_implementation); 
    WaverContractAddress = msg.sender;   
  }

function changeAddress (address _mainContract) public onlyOwner {
    WaverContractAddress = _mainContract;
}
function getBeacon() public view returns(address) {
    return address (thisWaverBeacon);
}
function getimplementation () public view returns(address){
return thisWaverBeacon.implementation();}

  function newMarriage(
    address _addressWaveContract,
    address _Forwarder,
    address _swapRouterAddress,
    uint id,
    address _waver,
    address _proposed, 
    uint256 _marryDate
  )
  public
 returns (address)
  {
    require (WaverContractAddress == msg.sender, "ACCESS DENIED");
      bytes memory dataOfnewMarriage = abi.encodeWithSelector(
        WaverImplementation(payable(address(0))).initialize.selector,
        _addressWaveContract,
        _Forwarder,
        _swapRouterAddress,
        id,
        _waver,
        _proposed, 
        _marryDate
      );
      
      BeaconProxy NewMarriageBeaconProxy = new BeaconProxy(
        address(thisWaverBeacon),
        dataOfnewMarriage
      );

      MarriageID[id] = address(NewMarriageBeaconProxy);
      return address(NewMarriageBeaconProxy);
  }

}