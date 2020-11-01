import React from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import FormControl from "react-bootstrap/FormControl";
import BigNumber from "bignumber.js";

function LotteryView({
  web3,
  web3Network,
  account,
  nextDrawTicketType,
  nextDrawTicketsInCirculation,
  ticketContract,
  beaconContract,
  lotteryContract,
  isIssuing,
  setIsIssuing,
}) {
  const [drawings, setDrawings] = React.useState([]);
  const [isActing, setActing] = React.useState(false);
  const [rewardAmount, setRewardAmount] = React.useState(null);

  async function loadIsIssuing() {
    if (lotteryContract) {
      let _isIssuing = await lotteryContract.methods.isIssuingTickets().call();
      setIsIssuing(_isIssuing);
    }
  }
  async function loadDrawings() {
    if (
      web3 == null ||
      lotteryContract == null ||
      beaconContract == null ||
      nextDrawTicketType == null
    ) {
      return;
    }
    var _drawingsP = [];
    for (let index = 0; index < localStorage.length; index++) {
      const k = localStorage.key(index);
      if (k.startsWith("drawing:") == false) {
        continue;
      }
      async function load() {
        const txHash = localStorage.getItem(k);

        const obj = await web3.eth.getTransactionReceipt(txHash);
        var status = null;
        var drawingObj = null;
        if (obj == null) {
          status = 0;
        } else if (obj.status == true) {
          drawingObj = await loadSuccessfulDrawing(obj);
          if (drawingObj.randomNum == null) {
            status = 0;
          } else {
            status = 1;
            const issueTxHash = localStorage.getItem(
              `reward:${drawingObj.beaconRequestId}`
            );

            if (issueTxHash) {
              const issuingObj = await web3.eth.getTransactionReceipt(
                issueTxHash
              );
              drawingObj.issuingObj = issuingObj;
              var issuingStatus;
              if (issuingObj == null) {
                issuingStatus = 0;
              } else if (issuingObj.status == true) {
                issuingStatus = 1;
              } else {
                issuingStatus = -1;
              }
              drawingObj.issuingStatus = issuingStatus;
            }
          }
        } else {
          status = -1;
        }

        return {
          key: k,
          txHash: txHash,
          drawingObj: drawingObj,
          status: status,
        };
      }

      _drawingsP.push(load(index));
    }

    const _drawings = await Promise.all(_drawingsP);

    _drawings.sort((a, b) => a.key < b.key);

    setDrawings(_drawings);
  }

  async function loadSuccessfulDrawing(txObj) {
    let lotteryEvents = await lotteryContract.getPastEvents("allEvents", {
      fromBlock: txObj.blockNumber,
      toBlock: txObj.blockNumber,
    });

    let beaconRequestId = lotteryEvents.filter(
      (v) =>
        v.transactionHash == txObj.transactionHash &&
        v.event == "LotteryDrawTriggered"
    )[0].returnValues._keepRequestID;

    let beaconEvents = await beaconContract.getPastEvents("allEvents", {
      fromBlock: txObj.blockNumber,
    });
    var randomNum;
    var winningTicket;
    var winner;

    let beaconEvent = beaconEvents.filter(
      (v) => v.returnValues.requestId == beaconRequestId
    )[0];

    if (beaconEvent != null) {
      randomNum = beaconEvent.returnValues.entry;

      winningTicket = await lotteryContract.methods
        .calculateWinningTicket(nextDrawTicketType, randomNum)
        .call();

      winner = await ticketContract.methods.ownerOf(winningTicket).call();
    }

    return {
      beaconRequestId: beaconRequestId,
      randomNum: randomNum,
      winningTicket: winningTicket,
      winner: winner,
      beaconEvent: beaconEvent,
    };
  }

  async function handleDraw() {
    setActing(true);

    const _rewardAmount = BigNumber(rewardAmount).times(BigNumber(10).pow(18));
    await lotteryContract.methods
      .triggerDrawTicket(_rewardAmount)
      .send({ from: account }, function (error, txHash) {
        if (error) {
          alert(error.message);
          setActing(false);
          setRewardAmount("");
          return;
        }

        var maxDraw = 0;
        for (let index = 0; index < localStorage.length; index++) {
          const k = localStorage.key(index);
          if (k.startsWith("drawing:")) {
            maxDraw++;
          }
        }

        localStorage.setItem(`drawing:${maxDraw}`, txHash);
        localStorage.setItem(`t:${txHash}:reward`, _rewardAmount.toString());
        setActing(false);
        setRewardAmount("");
        loadDrawings();
      })
      .once("receipt", (receipt) => {
        loadDrawings();
      });
  }

  async function handleStopIssuing() {
    setActing(true);

    await lotteryContract.methods
      .stopIssuingTickets()
      .send({ from: account }, function (error, txHash) {
        if (error) {
          alert(error.message);
          setActing(false);
          return;
        }
        setActing(false);
      })
      .once("receipt", (receipt) => {
        loadDrawings();
        loadIsIssuing();
      });
  }

  async function handleStartIssuing() {
    setActing(true);

    await lotteryContract.methods
      .startIssuingTickets()
      .send({ from: account }, function (error, txHash) {
        if (error) {
          alert(error.message);
          setActing(false);
          return;
        }
        setActing(false);
      })
      .once("receipt", (receipt) => {
        localStorage.clear();
        loadDrawings();
        loadIsIssuing();
      });
  }

  function issueReward(beaconRequestId, winner, winningTicket, reward) {
    return async () => {
      setActing(true);
      await lotteryContract.methods
        .issueReward(beaconRequestId, winner, winningTicket, reward)
        .send({ from: account }, function (error, txHash) {
          if (error) {
            alert(error.message);
            setActing(false);
            return;
          }

          localStorage.setItem(`reward:${beaconRequestId}`, txHash);
          setActing(false);
          loadDrawings();
        })
        .once("receipt", (receipt) => {
          loadDrawings();
          loadIsIssuing();
        });
    };
  }

  React.useEffect(() => {
    loadDrawings();
    loadIsIssuing();
  }, [
    web3,
    lotteryContract,
    beaconContract,
    ticketContract,
    nextDrawTicketType,
  ]);

  var _drawings = [];
  drawings.forEach((obj) => {
    const _reward = localStorage.getItem(`t:${obj.txHash}:reward`);
    const displayReward = (BigNumber(_reward) / 10 ** 18).toString();
    const statusType =
      obj.status > 0 ? "success" : obj.status < 0 ? "danger" : "secondary";
    var successFields = null;
    if (obj.drawingObj) {
      var issueButton;
      if (obj.drawingObj.issuingStatus != null) {
        if (obj.drawingObj.issuingStatus == 1) {
          issueButton = (
            <Button
              variant="success"
              className="text-dark"
              size="lg"
              disabled={true}
            >
              Sent Reward
            </Button>
          );
        } else if (obj.drawingObj.issuingStatus == 0) {
          issueButton = (
            <Button
              variant="secondary"
              className="text-dark"
              size="lg"
              disabled={true}
            >
              Sending Reward
            </Button>
          );
        } else if (obj.drawingObj.issuingStatus == -1) {
          issueButton = (
            <Button
              variant="danger"
              className="text-dark"
              size="lg"
              disabled={true}
            >
              Failed Sending Reward
            </Button>
          );
        }
      } else {
        issueButton = (
          <Button
            variant="primary"
            className="text-dark"
            size="lg"
            disabled={isActing}
            onClick={
              !isActing
                ? issueReward(
                    obj.drawingObj.beaconRequestId,
                    obj.drawingObj.winner,
                    obj.drawingObj.winningTicket,
                    _reward
                  )
                : null
            }
          >
            Send Reward to Winner!
          </Button>
        );
      }
      successFields = (
        <>
          <Col md="6" className="text-center">
            {issueButton}
          </Col>
          <Col md="6">
            <p>Owner of Winning Ticket: {obj.drawingObj.winner}</p>
            <p>Reward: {displayReward} rKEEP</p>
          </Col>
        </>
      );
    }
    const elem = (
      <Row className="my-5" key={obj.key}>
        {successFields}
      </Row>
    );
    _drawings.push(elem);
  });

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
            </>
          ) : (
            <h3 className="text-warning">Please Connect Wallet</h3>
          )}
        </Col>
      </Row>
      <Row>
        <Col md="12" className="mx-auto text-center">
          <Button
            className="text-dark"
            variant="primary"
            size="lg"
            disabled={isActing}
            onClick={
              !isActing
                ? isIssuing
                  ? handleStopIssuing
                  : handleStartIssuing
                : null
            }
          >
            {isIssuing
              ? "End Current Sale of Tickets NOW!"
              : "Create New Lottery"}
          </Button>
        </Col>
      </Row>
      <Row className="my-5 text-center">
        <Col>
          <h1>REWARD: 300,000 rKEEP</h1>
          <h1>Next Lottery Drawing (Nov 7 2020)</h1>
        </Col>
      </Row>
      {!isIssuing ? (
        <>
          <Row>
            <h2>INSTRUCTIONS ON DRAWING WINNERS AND SENDING REWARDS</h2>
            <ol>
              <li>Be sure to End Current Sale of Tickets (above)</li>
              <li>Each winner will be selected one at a time.</li>
              <li>
                First you select the winner, then you issue to the reward. To
                ensure a proper audit trail, you must enter the reward amount in
                order to draw the ticket.
              </li>
              <li>
                Once winner has been selected, a button will appear to “Send
                Reward to Winner!”
              </li>
              <li>Repeat steps 3 & 4 for subsequent awards</li>
            </ol>
          </Row>
          <Row>
            <h2>Notes</h2>
          </Row>
          <Row>
            <ul>
              <li>
                Drawing state is currently stored in the browser. It is best to
                perform all ticket drawings for a single lottery in the same
                browser
              </li>
            </ul>
          </Row>
          <Row className="my-5">
            {nextDrawTicketType != null ? (
              <Col md="8" className="mx-auto text-center mb-5">
                {nextDrawTicketsInCirculation > 0 ? (
                  <>
                    <InputGroup>
                      <FormControl
                        placeholder="Amount to be sent to winner, once drawn"
                        aria-label="Reward Amount"
                        aria-describedby="reward"
                        onChange={(e) => setRewardAmount(e.target.value)}
                      />
                      <InputGroup.Append>
                        <Button
                          variant="primary"
                          className="text-dark"
                          disabled={isActing}
                          onClick={!isActing ? handleDraw : null}
                        >
                          Draw Winner, Transfer Reward
                        </Button>
                      </InputGroup.Append>
                    </InputGroup>
                  </>
                ) : (
                  <span className="text-warning">
                    No tickets to draw. Please end current lottery.
                  </span>
                )}
              </Col>
            ) : null}
          </Row>
          {_drawings}
        </>
      ) : null}
    </Container>
  );
}

export default LotteryView;
