
export const API = '/api/';
export function wrapRequest(request) {
	if (!request) {
		request = {
			method: 'GET',
			headers: {}
		};
	}

	const headerAdditions = {
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}
	};

	Object.assign(request, headerAdditions);
	return request;
}