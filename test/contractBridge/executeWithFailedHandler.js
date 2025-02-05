const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
const ERC20HandlerContract = artifacts.require("HandlerRevert");

contract('Bridge - [execute - FailedHandlerExecution]', async accounts => {
    const originDomainID = 1;
    const destinationDomainID = 2;
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const relayer1Address = accounts[3];
    const relayer2Address = accounts[4];

    const initialTokenAmount = 100;
    const depositAmount = 10;
    const expectedDepositNonce = 1;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let resourceID;
    let depositData;
    let depositProposalData;
    let depositProposalDataHash;

    beforeEach(async () => {
        await Promise.all([
            BridgeContract.new(destinationDomainID).then(instance => BridgeInstance = instance),
            ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance)
        ]);

        resourceID = Helpers.createResourceID(ERC20MintableInstance.address, originDomainID);

        ERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address);

        await Promise.all([
            ERC20MintableInstance.mint(depositerAddress, initialTokenAmount),
            BridgeInstance.adminSetResource(ERC20HandlerInstance.address, resourceID, ERC20MintableInstance.address)
        ]);

        await ERC20MintableInstance.approve(ERC20HandlerInstance.address, 5000, { from: depositerAddress });

        depositData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        depositProposalData = Helpers.createERCDepositData(depositAmount, 20, recipientAddress)
        depositProposalDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositProposalData.substr(2));

        // set MPC address to unpause the Bridge
        await BridgeInstance.endKeygen(Helpers.mpcAddress);
    });

    it("Should revert if handler execute is reverted", async () => {
        const depositProposalBeforeFailedExecute = await BridgeInstance.isProposalExecuted(
            originDomainID, expectedDepositNonce);

        // depositNonce is not used
        assert.isFalse(depositProposalBeforeFailedExecute);

        const proposalSignedData = await Helpers.signDataWithMpc(
          originDomainID, destinationDomainID, expectedDepositNonce, depositProposalData, resourceID
        );

        await TruffleAssert.reverts(BridgeInstance.executeProposal(
            originDomainID,
            expectedDepositNonce,
            depositProposalData,
            resourceID,
            proposalSignedData,
            { from: relayer2Address }
        ));

        const depositProposalAfterFailedExecute = await BridgeInstance.isProposalExecuted(
           originDomainID, expectedDepositNonce);

        // depositNonce is not used
        assert.isFalse(depositProposalAfterFailedExecute);
    });
});
