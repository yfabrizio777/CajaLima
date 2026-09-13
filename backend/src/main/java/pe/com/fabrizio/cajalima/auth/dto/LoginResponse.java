package pe.com.fabrizio.cajalima.auth.dto;

public record LoginResponse(String token, String type, long expiresIn) {
    @Override
    public String toString() { return "LoginResponse[redacted]"; }
}
