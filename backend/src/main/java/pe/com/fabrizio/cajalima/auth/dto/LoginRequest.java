package pe.com.fabrizio.cajalima.auth.dto;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import jakarta.validation.constraints.*;

public record LoginRequest(
        @NotBlank @Email @Size(max = 180) String email,
        @NotBlank @Size(max = 72) String password) {
    public LoginRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    @AssertTrue(message = "La contraseña no debe superar 72 bytes UTF-8.")
    public boolean isPasswordWithinBcryptLimit() {
        return password == null || password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    @Override
    public String toString() { return "LoginRequest[redacted]"; }
}
