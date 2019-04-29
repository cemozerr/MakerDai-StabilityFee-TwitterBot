const fetch = require('node-fetch');
const Twitter = require('twitter');
const firebase = require('firebase');
require('dotenv').config()

const secondsPerYear = 3.154e+7;
var twitterClient;

// Your web app's Firebase configuration
var firebaseConfig = {
	apiKey: process.env.FIREBASE_API_KEY,
	authDomain: "stabilityfeebotlastblock.firebaseapp.com",
	databaseURL: "https://stabilityfeebotlastblock.firebaseio.com",
	projectId: "stabilityfeebotlastblock",
	storageBucket: "",
	messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.FIREBASE_API_ID
};

async function main(){
	// Initialize Firebase
	let firebaseApp = firebase.initializeApp(firebaseConfig);

	let lastQueriedBlockRef = firebase.database().ref('lastQueriedBlock/');
	let snapshot = await lastQueriedBlockRef.once('value');
	let lastQueriedBlock = snapshot.val();

	console.log("Checking fee again");
	console.log("Last queried block at " + lastQueriedBlock);
	let currentBlockQueryString = 'https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey='
		+ process.env.ETHERSCAN_API_KEY;
	let currentBlock = await getRequest(currentBlockQueryString);
	currentBlock = parseInt(currentBlock, 16);
	console.log("Current block at " + currentBlock);

	let queryString = 'https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=' +
		lastQueriedBlock + '&toBlock=' + currentBlock +
		'latest&address=0xf2c5369cffb8ea6284452b0326e326dbfdcb867c&'+
		'topic0=0x69fe0e2d00000000000000000000000000000000000000000000000000000000&apikey='
		+ process.env.ETHERSCAN_APIKEY;
	let events = await getRequest(queryString);


	if (events.length != 0){
		twitterClient = initTwitterClient();
	} else {
		console.log('No fee change for the latest period.');
	}

	events.forEach((event) => {
		console.log('Posting fee change/s.');
			if (event.topics[0] == '0x69fe0e2d00000000000000000000000000000000000000000000000000000000'){
				let fee = event.topics[2];
				console.log(event);
				fee = Math.pow(parseInt(fee, 16) / 1e+27, secondsPerYear);
				let feeInPercentage = round((fee - 1)*100, 2);
				postFeeOnTwitter(feeInPercentage, event.transactionHash);
			}
	});
	
	await lastQueriedBlockRef.set(currentBlock);
	await firebaseApp.delete();
}

function initTwitterClient(){
	return new Twitter({
		consumer_key: process.env.TWITTER_CONSUMER_KEY,
		consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
		access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
		access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET 
	});
}

async function getRequest(queryString){
	let response = await fetch(queryString);
	let body = await response.json();
	return body.result;
}

function round(value, precision) {
	var multiplier = Math.pow(10, precision || 0);
	return Math.round(value * multiplier) / multiplier;
}

function postFeeOnTwitter(fee, txHash){
	twitterClient.post(
		'statuses/update',
		{ status: '⚠️  DAI stability fee is now at ' + fee + '%.  ⚠️' + '\n http://etherscan.io/tx/' + txHash}, 
		function(error, tweet, response) {
			console.log(error);
			console.log(tweet);
			if (error) throw error;
		}
	);
}

main();
setInterval(main, 1200000);
