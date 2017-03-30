
export const API = '/api/';

export function wrapRequest(request) {
	if (!request) {
		request = {
			method: 'GET',
			headers: {}
		};
	}

	const encoded = Buffer.from('api:16CHAR_API_TOKEN').toString('base64');

	const headerAdditions = {
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'Authorization': 'Basic ' + encoded
		}
	};

	Object.assign(request, headerAdditions);
	return request;
}