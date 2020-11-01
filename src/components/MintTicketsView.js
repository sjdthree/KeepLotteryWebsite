import React, { useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";

function MintTicketsView({
  web3,
  web3Network,
  account,
  ticketContract,
  nextDrawTicketType,
  isIssuing,
}) {
  const [isActing, setActing] = React.useState(false);
  const [ticketIssued, setTicketIssued] = React.useState(false);
  const [ticketBalance, setTicketBalance] = useState(null);

  async function updateWalletBalance() {
    if (ticketContract && account && nextDrawTicketType) {
      let balance = await ticketContract.methods
        .balanceOf(account, nextDrawTicketType)
        .call();
      setTicketBalance(balance);
    }
  }

  async function handleAction() {
    setActing(true);

    await ticketContract.methods
      .mintTicket(account, nextDrawTicketType)
      .send({ from: account }, function (error, txHash) {
        if (error) {
          alert(error.message);
          setActing(false);
          return;
        }

        setTicketIssued(true);
      })
      .once("receipt", async function (receipt) {
        await updateWalletBalance();
      });

    setActing(false);
  }

  useEffect(() => {
    updateWalletBalance();
  }, [ticketContract, account, nextDrawTicketType]);

  return (
    <Container>
      <Row className="my-5">
        <Col>
          {account != null ? (
            <>
              <h4>Wallet Connected</h4>
              <p>
                Network: {web3Network}
                <br />
                Address: {account}
              </p>
              <br />
              {ticketBalance != null ? (
                <>
                  <h4>Current Lottery Ticket Balance:</h4>
                  <h4>
                    <img alt="" src="/ticket.svg" width="200" height="100" />{" "}
                    {ticketBalance} Ticket{ticketBalance != 1 ? "s" : ""}
                  </h4>
                </>
              ) : null}
            </>
          ) : (
            <h3 className="text-warning">Please Connect Wallet</h3>
          )}
        </Col>
      </Row>
      {isIssuing ? (
        <>
          <Row className="my-5">
            <Col md="6">
              <h1>
                Buy a lottery ticket{" "}
                <span class="font-weight-light font-italic">0 rETH</span>
              </h1>
              <p>(Just pay the gas fee in rETH)</p>
            </Col>
            <Col>
              <InputGroup>
                <Button
                  className="text-dark"
                  variant="primary"
                  size="lg"
                  disabled={isActing}
                  onClick={!isActing ? handleAction : null}
                >
                  Buy
                </Button>
              </InputGroup>
            </Col>
          </Row>
        </>
      ) : (
        <>
          <Row className="my-5">
            <Col md="6">
              <h1>Lottery tickets not available </h1>
              <p>Come back later when a lottery is happening.</p>
            </Col>
          </Row>
        </>
      )}

      <Row className="my-5 text-center">
        <Col>
          {isActing ? (
            <>
              <h1>Buying ticket...</h1>
              <p>
                Please wait for transaction to finish. Do not close this window.
                If transaction fails, increase Gas Fees or select "Speed up" in
                Metamask. This can take up to 30 seconds.
              </p>
            </>
          ) : ticketIssued ? (
            <>
              <h1>Here's your ticket!</h1>
              <img alt="" src="/ticket.svg" width="300" height="200" />
            </>
          ) : (
            <>
              {" "}
              <h1>REWARD: 300,000 rKEEP</h1>
              <h1>Next Lottery Drawing (Nov 7 2020)</h1>
            </>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default MintTicketsView;
