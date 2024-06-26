const fetch = require('node-fetch');
const qs = require('qs');
const requireAll = require('require-all');
const retry = require('async-retry');
const util = require('util');

const { RequestError } = require('./error');

const DEFAULT_API_BASE_PATH = '/api/v1';
const RETRY_COUNT = 2;

class ShotgunApiClient {

	constructor({ siteUrl, credentials, debug, apiBasePath = DEFAULT_API_BASE_PATH }) {

		this.siteUrl = siteUrl;
		this.credentials = credentials;
		this._token = null;
		this.debug = debug;

		if (apiBasePath && !apiBasePath.startsWith('/'))
			apiBasePath = '/' + apiBasePath;

		this.apiBasePath = apiBasePath;
	}

	get token() {
		return this._token;
	}

	set token(val) {
		this._token = val;
	}

	async connect(credentials = this.credentials) {

		let { siteUrl, apiBasePath } = this;

		let url = new URL(`${siteUrl}${apiBasePath}/auth/access_token`);
		// @NOTE Should they be cleared from memory at this time?
		url.search = qs.stringify(credentials);

		let resp = await this.fetchWithRetry(url, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
			}
		});

		if (!resp.ok) {

			let respBody = await resp.text();
			let errorResp = new RequestError({ respBody });
			throw new Error(`Error getting connect response: ${errorResp}`);
		}

		let body;
		try {
			body = await resp.json();
		} catch (err) {
			throw new Error(`Error parsing connect response: ${err.message}`);
		}

		this.token = body;
		return body;
	}

	async refreshToken() {

		let { siteUrl, apiBasePath, token } = this;

		if (!token)
			return await this.connect();

		let url = new URL(`${siteUrl}${apiBasePath}/auth/access_token`);
		url.search = qs.stringify({
			refresh_token: token.refresh_token,
			grant_type: 'refresh',
		});

		let resp = await this.fetchWithRetry(url, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
			}
		});

		if (!resp.ok) {

			let respBody = await resp.text();
			let errorResp = new RequestError({ respBody });
			throw new Error(`Error getting refresh token response: ${errorResp}`);
		}

		let body;
		try {
			body = await resp.json();
		} catch (err) {
			throw new Error(`Error parsing refresh token response: ${err.message}`);
		}

		this.token = body;
		return body;
	}

	tokenExpired(token) {

		if (!token)
			return false;

		let jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

		return (Date.now() / 1000) > jwtPayload.exp;
	}

	async getAuthorizationHeader() {

		let { token } = this;

		if (!token || this.tokenExpired(token.refresh_token))
			token = await this.connect();
		else if (this.tokenExpired(token.access_token))
			token = await this.refreshToken();

		return `${token.token_type} ${token.access_token}`;
	}

	async requestRaw({ method = 'GET', path, headers, query, body, requestId, skipBasePathPrepend }) {

		let { siteUrl, apiBasePath, debug } = this;

		if (!path)
			path = '/';

		if (!path.startsWith('/'))
			path = '/' + path;

		if (apiBasePath && !skipBasePathPrepend)
			path = `${apiBasePath}${path}`;

		if (!headers)
			headers = {};

		let inHeaders = headers;
		headers = Object.assign({
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': await this.getAuthorizationHeader(),
		}, inHeaders);

		let url = new URL(path, siteUrl);
		if (query)
			url.search = qs.stringify(query);

		if (body)
			body = JSON.stringify(body);

		if (debug)
			console.log('Sending request', requestId, url.href, util.inspect({ method, headers, body }, false, Infinity, true));

		let resp = await this.fetchWithRetry(url, { method, headers, body });
		return resp;
	}

	async request(params) {

		let { debug } = this;
		let { method, path } = params;

		let requestId = Math.random().toString(36).substr(2);
		let resp = await this.requestRaw({ ...params, requestId });

		let respBody;
		try {
			respBody = await resp.json();
		} catch (err) {
			// Do nothing
		}

		if (debug)
			console.log('Response received', requestId, util.inspect(respBody, false, Infinity, true));

		if (!resp.ok)
			throw new RequestError({ method, path, respBody, resp });

		return respBody;
	}

	async fetchWithRetry(...args) {

		let { debug } = this;

		return retry(
			async (fnBail, attemptNumber) => {
				if (debug)
					console.log(`Request attempt #${attemptNumber}`);

				let resp = await fetch(...args);
				if (attemptNumber <= RETRY_COUNT && (resp.status >= 500 || resp.status === 0)) {
					throw new Error('Force-trigger retry');
				}
				return resp;
			},
			{
				retries: RETRY_COUNT,
			}
		);
	}
}

module.exports = {
	default: ShotgunApiClient,
	ShotgunApiClient,
};

// Apply mixins (Modified for webpack)
require('./client/entity-batch')
require('./client/entity-create')
require('./client/entity-delete')
require('./client/entity-item-upload')
require('./client/entity-read-all')
require('./client/entity-api3-read-all')
require('./client/entity-read')
require('./client/entity-revive')
require('./client/entity-search')
require('./client/entity-update')
require('./client/preferences-get')
require('./client/schema-field-create')
require('./client/schema-field-delete')
require('./client/schema-field-revive')
require('./client/schema-field-update')
require('./client/schema-get')
