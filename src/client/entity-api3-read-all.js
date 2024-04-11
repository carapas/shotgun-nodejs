const { ShotgunApiClient } = require('shotgun-nodejs/src/client');
const { PaginatedRecordResponse } = require('shotgun-nodejs/src/paginated-record-response');

/**
 * Read multiple entities.
 *
 * @param  {string}       options.entity       - Entity type.
 * @param  {Object}       [options.filter]     - List of filters.
 * @param  {Array|String} [options.fields]     - List of fields to show.
 * @param  {Array|String} [options.sort]       - List of ordering fields.
 * @param  {number}       [options.pageSize]   - Upper limit of items shown on response page.
 * @param  {number}       [options.pageNumber] - Position in list of items to start querying from.
 * @param  {Object}       [options.options]    - Request option settings.
 * @return {PaginatedRecordResponse} Targered partial response.
 */
ShotgunApiClient.prototype.entityReadAllAPI3 = async function({ entity, filter, fields, sort, pageSize, pageNumber, additionalFilterPresets, options }) {

	let query = {
		paging: {
			entities_per_page: pageSize || 500,
			current_page: pageNumber || 1,
		},
	};

	query["type"] = entity

	//if (filter) {
	//	for (let k in filter) {
	//		query[`filter[${k}]`] = filter[k];
	//	}
	//}
	query.filters = filter

	if (fields)
		query.return_fields = fields;

	if (additionalFilterPresets)
		query.additional_filter_presets = additionalFilterPresets;

	//if (Array.isArray(sort))
	//	sort = sort.join(',');
	//if (sort)
	//	query.sort = sort;

	//if (options) {
	//	query.options = options;
	//}

	let respBody = await this.request({
		method: 'POST',
		path: `/api3/json`,
		body: {method_name: "read", params: [{session_token: this.credentials.session_token}, query]},
		skipBasePathPrepend: true
	});
	let results = respBody.results || {entities: []}
	let entities = results.entities
	return new PaginatedRecordResponse({data: entities, _pageSize: pageSize});
};
