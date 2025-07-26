export interface MCPRequest {
    id: string;
    method: string;
    params?: any;
}

export interface MCPResponse {
    id: string;
    result?: any;
    error?: MCPError;
}

export interface MCPError {
    code: number;
    message: string;
    data?: any;
}

export interface MCPNotification {
    method: string;
    params?: any;
}