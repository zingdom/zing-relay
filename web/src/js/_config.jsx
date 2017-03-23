
export const API = 'http://192.168.86.112:39511/api/';

export function wrapRequest(request) {
    if (!request) {
        request = {
            method: "GET",
            headers: {}
        };
    }

    const headerAdditions = {
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Basic YWRtaW46ZGJGTVM2NHA="
        }
    };


    Object.assign(request, headerAdditions);

    return request;

}