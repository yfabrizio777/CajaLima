package pe.com.fabrizio.cajalima.user.dto;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import jakarta.validation.constraints.*;

public record CreateUserRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 180) String email,
        @NotBlank @Size(min = 8, max = 72) String password) {
    public CreateUserRequest {
        name = name == null ? null : name.strip();
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    @AssertTrue(message = "La contraseña no debe superar 72 bytes UTF-8.")
    public boolean isPasswordWithinBcryptLimit() {
        return password == null || password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    @Override
    public String toString() { return "CreateUserRequest[redacted]"; }
}
