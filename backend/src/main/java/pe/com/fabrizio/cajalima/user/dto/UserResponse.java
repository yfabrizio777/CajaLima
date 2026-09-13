package pe.com.fabrizio.cajalima.user.dto;

import pe.com.fabrizio.cajalima.user.domain.User;
import pe.com.fabrizio.cajalima.user.domain.UserRole;

public record UserResponse(Long id, String name, String email, UserRole role, boolean active) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isActive());
    }
}
