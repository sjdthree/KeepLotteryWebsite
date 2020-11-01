import React, { useState, useEffect } from "react";
import Web3 from "web3";
import BigNumber from "bignumber.js";
import LotteryView from "./components/LotteryView";
import MintTicketsView from "./components/MintTicketsView";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import "./App.scss";

const ticketContractABI = require("./contracts/MintableTicket.json");
const lotteryContractABI = require("./contracts/Lottery.json");
const beaconContractABI = require("./contracts/IRandomBeacon.json");

const ticketContractAddress = process.env.REACT_APP_TICKET_CONTRACT_ADDRESS;

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [web3Network, setWeb3Network] = useState(null);
  const [activeTab, setActiveTab] = useState(window.location.hash.substr(1));
  const [ticketContract, setTicketContract] = useState(null);
  const [lotteryContract, setLotteryContract] = useState(null);
  const [beaconContract, setBeaconContract] = useState(null);
  const [nextDrawTicketType, setNextDrawTicketType] = useState(null);
  const [
    nextDrawTicketsInCirculation,
    setNextDrawTicketsInCirculation,
  ] = useState(null);
  const [isIssuing, setIsIssuing] = useState(null);

  // Setup Web3
  let _web3;
  const setupWeb3 = async () => {
    if (window.ethereum) {
      _web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.enable();
        // User has allowed account access to DApp...
        console.log("Account:", window.web3.eth.defaultAccount);
        setAccount(window.web3.eth.defaultAccount);
        _web3.eth.net.getNetworkType().then((network) => {
          setWeb3Network(network);
          if (network !== "ropsten")
            alert("Please Switch to Ropsten to use this DApp");
        });
      } catch (e) {
        // User has denied account access to DApp...
      }
    }
    // Legacy DApp Browsers
    else if (window.web3) {
      _web3 = new Web3(window.web3.currentProvider);
      _web3.eth.net.getNetworkType().then((network) => {
        setWeb3Network(network);
        if (network !== "ropsten")
          alert("Please Switch to Ropsten to use this DApp");
      });
    }
    // Non-DApp Browsers
    else {
      alert("You have to install MetaMask!");
    }

    setWeb3(_web3);
  };

  // Setup Contracts on App Load
  useEffect(() => {
    async function contractsSetup() {
      await setupWeb3();

      const _ticketContract = new _web3.eth.Contract(
        ticketContractABI.abi,
        ticketContractAddress
      );
      setTicketContract(_ticketContract);

      const _lotteryContractAddress = await _ticketContract.methods
        .lotteryContract()
        .call();

      const _lotteryContract = new _web3.eth.Contract(
        lotteryContractABI.abi,
        _lotteryContractAddress
      );
      setLotteryContract(_lotteryContract);

      const _beaconContractAddress = await _lotteryContract.methods
        .randomBeacon()
        .call();

      const _beaconContract = new _web3.eth.Contract(
        beaconContractABI.abi,
        _beaconContractAddress
      );
      setBeaconContract(_beaconContract);

      const _nextDrawTicketType = await _lotteryContract.methods
        .getNextDrawTicketType()
        .call();
      setNextDrawTicketType(_nextDrawTicketType);

      const _nextDrawTicketsInCirculation = await _ticketContract.methods
        .maxIndex(_nextDrawTicketType)
        .call();
      setNextDrawTicketsInCirculation(_nextDrawTicketsInCirculation);

      let _isIssuing = await _lotteryContract.methods.isIssuingTickets().call();
      setIsIssuing(_isIssuing);
    }
    contractsSetup();
  }, []);

  var tab = null;
  if (activeTab == "admin") {
    tab = (
      <LotteryView
        web3={web3}
        web3Network={web3Network}
        account={account}
        nextDrawTicketType={nextDrawTicketType}
        nextDrawTicketsInCirculation={nextDrawTicketsInCirculation}
        ticketContract={ticketContract}
        beaconContract={beaconContract}
        lotteryContract={lotteryContract}
        isIssuing={isIssuing}
        setIsIssuing={setIsIssuing}
      />
    );
  } else {
    tab = (
      <MintTicketsView
        web3={web3}
        web3Network={web3Network}
        account={account}
        ticketContract={ticketContract}
        nextDrawTicketType={nextDrawTicketType}
        isIssuing={isIssuing}
      />
    );
  }

  return (
    <>
      <Container fluid>
        <Row>
          <Col className="text-center bg-dark text-light py-3">
            <h1 className="display-4" style={{ "font-family": "Roboto Slab" }}>
              <img
                alt=""
                src="/logo.svg"
                width="70"
                height="70"
                className="d-inline-block align-top mx-3"
              />{" "}
              Keep Lottery
            </h1>
          </Col>
        </Row>
      </Container>
      {tab}
    </>
  );
}

export default App;
