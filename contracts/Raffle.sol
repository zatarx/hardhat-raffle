// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AutomationCompatible} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);
error Raffle__NotEnoughWords(uint256 wordsReturned);
error OnlyForwarder();

contract Raffle is VRFConsumerBaseV2Plus, AutomationCompatible {
    enum RaffleState {
        OPEN,
        CALCULATING
    } // implicitly uint256, 0 = OPEN, 1 = CAlCULATING

    struct CheckUpkeepStats {
        bool isOpen;
        bool hasBalance;
        bool hasPlayers;
        bool isTimePassed;
    }

    address private s_forwarderAddress;
    address payable[] private s_players;
    uint256 private s_lastUpkeepTimestamp;
    uint256 private immutable i_entranceFee;
    uint256 private immutable i_minExecutionBalance;
    bytes32 private immutable i_gasLane;
    uint256 private immutable i_subId;
    uint32 private immutable i_interval;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant CALLBACK_GAS_LIMIT = 1000000 wei;
    uint32 private constant NUM_WORDS = 1;
    uint256 private constant MIN_PLAYERS_AMOUNT = 1;

    // Lottery variables
    address payable private s_recentWinner;
    RaffleState private s_raffleState;

    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address payable recentWinner);
    event ForwarderAddressUpdated(
        address indexed currentForwardedAddress,
        address indexed updatedForwardedAddress
    );

    constructor(
        address vrfCoordinatorV2Plus,
        uint256 entrenceFee,
        uint256 minExecutionBalance,
        bytes32 gasLane, // aka keyHash
        uint256 subId,
        uint32 interval
    ) VRFConsumerBaseV2Plus(vrfCoordinatorV2Plus) {
        i_entranceFee = entrenceFee;
        i_minExecutionBalance = minExecutionBalance;
        i_gasLane = gasLane;
        i_subId = subId;
        i_interval = interval;
        s_raffleState = RaffleState.OPEN;
        s_lastUpkeepTimestamp = block.timestamp;
    }

    /// @dev Offchain execution (via eth_call) is enforced via cannotExecute.
    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool _isOpen = (s_raffleState == RaffleState.OPEN);
        bool _timePassed = ((block.timestamp - s_lastUpkeepTimestamp) >
            i_interval);
        bool _hasPlayers = (s_players.length >= MIN_PLAYERS_AMOUNT);
        bool _hasBalance = address(this).balance >= i_minExecutionBalance;

        upkeepNeeded = (_isOpen && _timePassed && _hasPlayers && _hasBalance);
        return (upkeepNeeded, "0x0");
    }

    /// @notice performUpkeep should only be called by a chainlink forwarder
    function performUpkeep(
        bytes memory /* performData */
    ) public override onlyForwarder {
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_gasLane,
                subId: i_subId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] calldata randomWords
    ) internal override {
        if (randomWords.length < NUM_WORDS) {
            revert Raffle__NotEnoughWords(randomWords.length);
        }
        uint256 winnerIndex = randomWords[0] % s_players.length;
        s_recentWinner = s_players[winnerIndex];

        (bool success, ) = s_recentWinner.call{value: address(this).balance}(
            ""
        );
        if (!success) {
            revert Raffle__TransferFailed();
        }

        s_players = new address payable[](0);
        s_lastUpkeepTimestamp = block.timestamp;
        s_raffleState = RaffleState.OPEN;

        emit WinnerPicked(s_recentWinner);
    }

    function enterRaffle() public payable returns (bool) {
        // require msg.value > i_entrenceFee
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
        return true;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getLastUpkeepTimestamp() public view returns (uint256) {
        return s_lastUpkeepTimestamp;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 playerIndex) public view returns (address) {
        return s_players[playerIndex];
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getMinExecutionBalance() public view returns (uint256) {
        return i_minExecutionBalance;
    }

    function setForwarderAddress(address forwarderAddress) public onlyOwner {
        require(forwarderAddress != address(0));
        emit ForwarderAddressUpdated(s_forwarderAddress, forwarderAddress);
        s_forwarderAddress = forwarderAddress;
    }

    modifier onlyForwarder() {
        if (msg.sender != s_forwarderAddress) {
            revert OnlyForwarder();
        }
        _;
    }
}
