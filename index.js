const Discord = require('discord.js');
const icy = require('icy');
const fs = require('fs');
const client = new Discord.Client();
const {
	prefix,
	token,
	voicechannel,
	logchannel,
	activity,
	list
} = require('./config.json');

var serverQueue = [...list];

client.once('ready', () => {
	clientLogMessage("initialized");
	playStream();
});

client.once('reconnecting', () => {
	clientLogMessage("reconnect successful");
	playStream();
});

client.once('disconnect', () => {
	clientLogMessage("disconnected");
});

client.on('message', async message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;
	const args = message.content.slice(prefix.length).split(' ');
	const command = args.shift().toLowerCase();
});

client.login(token);

function playStream() {
	client.channels.fetch(voicechannel).then(chanel => {
		chanel.join().then(connection => {
			clientLogMessage("vc init");
			if (activity) changeActivity(activity);
			
			connection.on("debug", e => {
				if (e.includes('[WS] >>') || e.includes('[WS] <<')) return;
				clientLogMessage("Connection warning - " + e);
				//if(e.includes('[WS] closed')) abortWithError();
			});
			connection.on("disconnect", () => {
				clientLogMessage("disconnect");
			});
			connection.on("error", e => {
				clientLogMessage("error");
				console.log(e);
			});
			connection.on("failed", e => {
				clientLogMessage("failed");
				console.log(e);
			});
			
			initDispatcher(connection);
		}).catch(e => {
			clientLogMessage("vc connection error");
			console.log(e);
		});
	}).catch(e => {
		clientLogMessage("channel not found (the fucking dev is an idiot)");
		console.log(e);
	});
}

function initDispatcher(connection) {
	clientLogMessage("broadcasting");
	
	if (serverQueue === undefined || serverQueue.length == 0) {
		clientLogMessage("looping m3u");
		serverQueue = [...list];
	}
	const currentTrack = serverQueue.shift();
	if (currentTrack.name) changeActivity(currentTrack.name);
	
	const streamDispatcher = connection.play(currentTrack.url, {
			volume: false,
			highWaterMark: 512,
			bitrate: 128,
			fec: true
		})
		.on("finish", () => {
			clientLogMessage("stream ended");
			streamDispatcher.destroy();
			initDispatcher(connection);
		});
		
	streamDispatcher.setBitrate(96);
	streamDispatcher.setFEC(true);
	
	streamDispatcher.on("debug", e => {
		clientLogMessage("dispatcher warning - " + e);
	});
	streamDispatcher.on("error", e => {
		clientLogMessage("broadcast connection error");
		console.log(e);
		abortWithError();
	});
	
	getICY(currentTrack.url);
}

function getICY(url) {
	const icyReader = icy.get(url, function (i) {
		i.on('metadata', function (metadata) {
			let icyData = icy.parse(metadata);
			if (icyData.StreamTitle) changeActivity(icyData.StreamTitle);
		});
		i.resume();
	});
}

function abortWithError() {
	clientLogMessage("either server dead or this shitty internet is");
	streamDispatcher.destroy();
	process.exit(1);
}

function clientLogMessage(message) {
	client.channels.fetch(logchannel).then(chanel => {
		chanel.send(message)
	}).catch(e => console.log(e));
	
	console.log(message);
}

function changeActivity(message) {
	clientLogMessage("now blaring " + message);
	client.user.setActivity(message, {
		type: 'LISTENING'
	});;
}